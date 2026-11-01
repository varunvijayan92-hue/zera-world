import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";
import { emailDelivery } from "../lib/email";
import { issueAdminAccountChange, applyAdminAccountChange } from "../lib/admin-account";
import { accountChangeSchema } from "../lib/admin-account-validation";
import { otpDigest } from "../lib/customer-otp";
import { POST } from "../app/api/admin/account/request-code/route";
const request = (body: unknown, origin = "https://store.example") => new Request("https://store.example/api/admin/account/request-code", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
test("admin account edits reject malformed profiles and weak or overlong passwords", () => {
  const base = { purpose: "PASSWORD", currentPassword: "old-password", newPassword: "new-secure-password" };
  assert.equal(accountChangeSchema.safeParse(base).success, true);
  for (const newPassword of ["short", "a".repeat(73), "é".repeat(37)]) assert.equal(accountChangeSchema.safeParse({ ...base, newPassword }).success, false);
  assert.equal(accountChangeSchema.safeParse({ purpose: "PROFILE", currentPassword: "old", profile: { fullName: "Admin", email: "admin", loginId: "admin" } }).success, false);
});
test("only authenticated admins can request changes and must prove their current password", async (t) => {
  const oldAuth = authContext.current, oldUser = prisma.user;
  let role = "CUSTOMER";
  authContext.current = async () => ({ id: "u", email: "admin", fullName: "Admin", role: role as "ADMIN", isActive: true });
  Object.assign(prisma, { user: { findUnique: async () => ({ id: "u", role: "ADMIN", isActive: true, email: "admin", passwordHash: await bcrypt.hash("correct-password", 4) }) } });
  t.after(() => { authContext.current = oldAuth; Object.assign(prisma, { user: oldUser }); });
  const body = { purpose: "PASSWORD", currentPassword: "wrong-password", newPassword: "a-strong-new-password" };
  assert.equal((await POST(request(body, "https://foreign.example"))).status, 403);
  for (role of ["CUSTOMER", "SUPPLIER", "MANAGER"]) assert.equal((await POST(request(body))).status, 403);
  role = "ADMIN";
  assert.equal((await POST(request(body))).status, 400);
  const missingEmail = await POST(request({ ...body, currentPassword: "correct-password" }));
  assert.equal(missingEmail.status, 400); assert.match((await missingEmail.json()).message, /verify a valid email/);
});
test("admin OTP is purpose-bound and password change atomically revokes sessions and erases pending data", async (t) => {
  process.env.JWT_SECRET = "test-admin-account-secret-at-least-32-characters";
  const original = prisma.$transaction;
  const row = { userId: "u", challengeId: "c", digest: otpDigest("admin-account:c", "123456"), sessionVersion: 0, purpose: "PASSWORD", email: "admin@example.test", payload: { passwordHash: "new-hash" }, attempts: 0, expiresAt: new Date(Date.now() + 60000), consumedAt: null as Date | null };
  let version = 0; let updated: unknown; let audit: unknown;
  const tx = { $queryRaw: async () => [{ ...row }], $executeRaw: async (sql: TemplateStringsArray) => { if (sql.join("").includes('"attempts"')) row.attempts++; else { row.consumedAt = new Date(); row.payload = {} as typeof row.payload; } return 1; }, user: { findUnique: async () => ({ id: "u", role: "ADMIN", isActive: true, sessionVersion: version, email: row.email }), updateMany: async (args: unknown) => { updated = args; return { count: 1 }; } }, auditLog: { create: async (args: unknown) => { audit = args; return {}; } } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal(await applyAdminAccountChange("u", "c", "000000"), false); assert.equal(updated, undefined);
  row.attempts = 5; assert.equal(await applyAdminAccountChange("u", "c", "123456"), false);
  row.attempts = 0; row.expiresAt = new Date(0); assert.equal(await applyAdminAccountChange("u", "c", "123456"), false);
  row.expiresAt = new Date(Date.now() + 60000); version = 1; assert.equal(await applyAdminAccountChange("u", "c", "123456"), false);
  version = 0; assert.equal(await applyAdminAccountChange("u", "c", "123456"), true);
  assert.deepEqual((updated as unknown as { data: unknown }).data, { passwordHash: "new-hash", sessionVersion: { increment: 1 } });
  assert.deepEqual(row.payload, {}); assert.doesNotMatch(JSON.stringify(audit), /new-hash|123456/);
  assert.equal(await applyAdminAccountChange("u", "c", "123456"), false);
});
test("sending failure invalidates admin pending changes without modifying the account", async (t) => {
  const query = prisma.$queryRaw, execute = prisma.$executeRaw, send = emailDelivery.send; let invalidated = false;
  Object.assign(prisma, { $queryRaw: async () => [{ userId: "u" }], $executeRaw: async () => { invalidated = true; return 1; } });
  emailDelivery.send = async () => { throw Error("provider failure"); };
  t.after(() => { Object.assign(prisma, { $queryRaw: query, $executeRaw: execute }); emailDelivery.send = send; });
  await assert.rejects(issueAdminAccountChange({ id: "u", email: "admin@example.test", sessionVersion: 0 }, { purpose: "PASSWORD", passwordHash: "hashed" }), /could not be sent/);
  assert.equal(invalidated, true);
});

