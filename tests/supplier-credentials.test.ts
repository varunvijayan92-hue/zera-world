import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import bcrypt from "bcryptjs";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";
import { sessionVersionMatches } from "../lib/session";
import { loginIdentityWhere } from "../lib/login-identity";
import { generateSupplierCredentials, supplierLoginCreateSchema, supplierCredentialUpdateSchema } from "../lib/supplier-credentials";
import { POST as registerSupplier } from "../app/api/suppliers/route";
import { PATCH as editCredentials } from "../app/api/admin/suppliers/[id]/credentials/route";

const password = "supplier-test-password-2026";
function actor(t: TestContext, role: UserRole) { t.mock.method(authContext, "current", async () => ({ id: "admin", fullName: "Test Actor", email: "test@example.test", role, isActive: true })); }
function model(t: TestContext, name: string, methods: Record<string, unknown>) { const target = prisma as unknown as Record<string, unknown>; const previous = target[name]; target[name] = methods; t.after(() => { target[name] = previous; }); }
function transaction(t: TestContext) { const original = prisma.$transaction; Object.assign(prisma, { $transaction: async (run: (tx: typeof prisma) => unknown) => run(prisma) }); t.after(() => Object.assign(prisma, { $transaction: original })); }
function request(body: unknown) { return new Request("https://store.example/api/test", { method: "POST", headers: { origin: "https://store.example", "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

test("generated supplier credentials are unique, normalized and accepted by the password policy", () => {
  const first = generateSupplierCredentials(); const second = generateSupplierCredentials();
  assert.notEqual(first.loginId, second.loginId); assert.notEqual(first.password, second.password);
  assert.equal(supplierLoginCreateSchema.safeParse(first).success, true);
  assert.equal(supplierLoginCreateSchema.parse({ loginId: " SUP-Example ", password }).loginId, "sup-example");
  for (const loginId of ["ab", "bad name", "bad@email.test", "../account"]) assert.equal(supplierLoginCreateSchema.safeParse({ loginId, password }).success, false);
  assert.equal(supplierLoginCreateSchema.safeParse({ ...first, password: "short" }).success, false);
  assert.equal(supplierLoginCreateSchema.safeParse({ ...first, password: "🙂".repeat(30) }).success, false);
  assert.equal(supplierCredentialUpdateSchema.safeParse({ userId: "u", password: "" }).success, false);
});
test("supplier login identities stay supplier-scoped and do not use nonunique display names", () => {
  const query = loginIdentityWhere(" SUP-Example ", "SUPPLIER");
  assert.equal(query.role, "SUPPLIER"); assert.ok(JSON.stringify(query).includes('"loginId":"sup-example"'));
  assert.equal(JSON.stringify(query).includes("fullName"), false);
  assert.ok(JSON.stringify(loginIdentityWhere("admin", "ADMIN")).includes("fullName"));
});
test("password resets revoke both versioned and legacy supplier sessions", () => {
  assert.equal(sessionVersionMatches({}, 0), true); assert.equal(sessionVersionMatches({}, 1), false);
  assert.equal(sessionVersionMatches({ version: 2 }, 2), true); assert.equal(sessionVersionMatches({ version: 2 }, 3), false);
});
test("managers cannot create or edit supplier login credentials", async (t) => {
  actor(t, "MANAGER");
  assert.equal((await registerSupplier(request({ companyName: "Supplier", email: "supplier@example.test", portalLogin: { loginId: "sup-test", password } }))).status, 403);
  assert.equal((await editCredentials(request({ userId: "supplier-user", password }), { params: Promise.resolve({ id: "supplier" }) })).status, 403);
});
test("supplier registration saves only a password hash and returns a safe login DTO", async (t) => {
  actor(t, "ADMIN"); transaction(t); let hash = ""; let audit = ""; let linked = false;
  model(t, "user", { findFirst: async () => null, create: async (args: { data: { passwordHash: string; loginId: string; email: string } }) => { hash = args.data.passwordHash; return { id: "supplier-user", loginId: args.data.loginId, email: args.data.email }; } });
  model(t, "supplier", { create: async () => ({ id: "supplier", companyName: "Supplier" }) });
  model(t, "supplierContact", { create: async () => { linked = true; return {}; } });
  model(t, "auditLog", { create: async (args: unknown) => { audit = JSON.stringify(args); return {}; } });
  const response = await registerSupplier(request({ companyName: "Supplier", email: "supplier@example.test", portalLogin: { loginId: "SUP-TEST", password } }));
  assert.equal(response.status, 201); assert.equal(linked, true); assert.equal(await bcrypt.compare(password, hash), true);
  const body = await response.json(); assert.equal(body.login.loginId, "sup-test");
  assert.equal(JSON.stringify(body).includes(password), false); assert.equal(JSON.stringify(body).includes(hash), false); assert.equal(audit.includes(password), false); assert.equal(audit.includes(hash), false);
});
test("external-site supplier records cannot receive portal logins", async (t) => {
  actor(t, "ADMIN");
  assert.equal((await registerSupplier(request({ companyName: "Source", sourceType: "EXTERNAL_SITE", email: "source@example.test", portalLogin: { loginId: "sup-source", password } }))).status, 400);
});
test("credential edits verify the supplier/user relation and advance the session version", async (t) => {
  actor(t, "ADMIN"); transaction(t); let owned = false; let change: Record<string, unknown> | undefined;
  model(t, "supplierContact", { findFirst: async (args: { where: { supplierId: string; userId: string; user: { role: string } } }) => { assert.equal(args.where.supplierId, "supplier"); assert.equal(args.where.userId, "supplier-user"); assert.equal(args.where.user.role, "SUPPLIER"); return owned ? { userId: "supplier-user" } : null; } });
  model(t, "user", { update: async (args: { data: Record<string, unknown> }) => { change = args.data; return { id: "supplier-user", loginId: "sup-edited", email: "supplier@example.test", isActive: true }; } });
  model(t, "auditLog", { create: async () => ({}) });
  const context = { params: Promise.resolve({ id: "supplier" }) };
  assert.equal((await editCredentials(request({ userId: "supplier-user", loginId: "sup-edited" }), context)).status, 404); assert.equal(change, undefined);
  owned = true;
  const response = await editCredentials(request({ userId: "supplier-user", loginId: "SUP-EDITED", password }), context);
  assert.equal(response.status, 200);
  const saved = change as unknown as { sessionVersion: { increment: number }; passwordHash: string; loginId: string };
  assert.equal(saved.sessionVersion.increment, 1); assert.equal(saved.loginId, "sup-edited"); assert.equal(await bcrypt.compare(password, saved.passwordHash), true);
  assert.equal((await response.text()).includes(saved.passwordHash), false);
});
