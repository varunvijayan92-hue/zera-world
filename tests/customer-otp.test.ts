import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { emailDelivery } from "../lib/email";
import { consumeCustomerOtp, issueCustomerOtp, otpDigest, otpMatches } from "../lib/customer-otp";
import { POST as login } from "../app/api/auth/login/route";

test("OTP digests bind the code to its challenge and never store plaintext", () => {
  process.env.JWT_SECRET = "unit-test-secret-at-least-thirty-two-characters";
  const digest = otpDigest("challenge-a", "012345");
  assert.equal(digest.length, 64);
  assert.ok(otpMatches("challenge-a", "012345", digest));
  assert.equal(otpMatches("challenge-b", "012345", digest), false);
  assert.equal(otpMatches("challenge-a", "999999", digest), false);
});

test("customer password login signs in immediately without a verification code", async (t) => {
  process.env.JWT_SECRET = "unit-test-secret-at-least-thirty-two-characters";
  const originalUser = prisma.user, originalQuery = prisma.$queryRaw, originalSend = emailDelivery.send;
  const user = { id: "otp-user", email: "buyer@example.test", fullName: "Buyer", role: "CUSTOMER", isActive: true, sessionVersion: 0, passwordHash: await bcrypt.hash("test-password", 4) };
  let emailCount = 0;
  Object.assign(prisma, { user: { findFirst: async () => user }, $queryRaw: async () => [{ userId: user.id }] });
  emailDelivery.send = async (message) => { emailCount++; assert.match(message.text, /\b\d{6}\b/); return "test-email"; };
  t.after(() => { Object.assign(prisma, { user: originalUser, $queryRaw: originalQuery }); emailDelivery.send = originalSend; });
  const request = (password: string) => new Request("https://store.example/api/auth/login", { method: "POST", headers: { origin: "https://store.example", "content-type": "application/json" }, body: JSON.stringify({ loginId: user.email, password }) });
  assert.equal((await login(request("wrong-password"))).status, 401);
  assert.equal(emailCount, 0);
  const response = await login(request("test-password"));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requiresOtp, undefined);
  assert.match(response.headers.get("set-cookie")!, /supplierbridge_session=/);
  assert.doesNotMatch(response.headers.get("set-cookie")!, /zera_customer_otp=/);
  assert.equal(emailCount, 0);
});

test("verification rejects expired, exhausted, changed-account and reused challenges", async (t) => {
  const original = prisma.$transaction;
  const row = { userId: "u", challengeId: "c", digest: otpDigest("c", "123456"), sessionVersion: 0, attempts: 0, expiresAt: new Date(Date.now() + 60000), consumedAt: null as Date | null };
  let user = { id: "u", role: "CUSTOMER", isActive: true, sessionVersion: 0 };
  const tx = { $queryRaw: async () => [{ ...row }], $executeRaw: async (sql: TemplateStringsArray) => { if (sql.join("").includes('"attempts"')) row.attempts++; else row.consumedAt = new Date(); return 1; }, user: { findUnique: async () => user } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal(await consumeCustomerOtp("c", "000000"), null);
  assert.equal(row.attempts, 1);
  row.attempts = 5; assert.equal(await consumeCustomerOtp("c", "123456"), null);
  row.attempts = 0; row.expiresAt = new Date(0); assert.equal(await consumeCustomerOtp("c", "123456"), null);
  row.expiresAt = new Date(Date.now() + 60000); user.sessionVersion = 1; assert.equal(await consumeCustomerOtp("c", "123456"), null);
  user = { ...user, sessionVersion: 0 }; assert.equal((await consumeCustomerOtp("c", "123456"))?.id, "u");
  assert.equal(await consumeCustomerOtp("c", "123456"), null);
});

test("failed email delivery invalidates the challenge and does not expose the code", async (t) => {
  const originalQuery = prisma.$queryRaw, originalExecute = prisma.$executeRaw, originalSend = emailDelivery.send;
  let invalidated = false;
  Object.assign(prisma, { $queryRaw: async () => [{ userId: "u" }], $executeRaw: async () => { invalidated = true; return 1; } });
  emailDelivery.send = async () => { throw Error("provider details"); };
  t.after(() => { Object.assign(prisma, { $queryRaw: originalQuery, $executeRaw: originalExecute }); emailDelivery.send = originalSend; });
  await assert.rejects(issueCustomerOtp({ id: "u", email: "buyer@example.test", sessionVersion: 0 }), /verification email could not be sent/);
  assert.equal(invalidated, true);
});

test("registration codes activate new customers atomically, while login codes cannot activate disabled users", async t => {
 const original=prisma.$transaction;let activated=false;
 const row={userId:"new",challengeId:"register",digest:otpDigest("register","123456"),sessionVersion:0,attempts:0,expiresAt:new Date(Date.now()+60000),consumedAt:null,purpose:"LOGIN"};
 const tx={$queryRaw:async()=>[{...row}],$executeRaw:async()=>1,user:{findUnique:async()=>({id:"new",role:"CUSTOMER",isActive:false,sessionVersion:0}),update:async()=>{activated=true;return {};}}};
 Object.assign(prisma,{$transaction:async(work:(client:typeof tx)=>unknown)=>work(tx)});t.after(()=>Object.assign(prisma,{$transaction:original}));
 assert.equal(await consumeCustomerOtp("register","123456"),null);assert.equal(activated,false);
 row.purpose="REGISTER";assert.equal((await consumeCustomerOtp("register","123456"))?.otpPurpose,"REGISTER");assert.equal(activated,true);
});
