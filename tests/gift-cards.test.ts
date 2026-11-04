import assert from "node:assert/strict";
import test from "node:test";
import { giftCardSchema, giftCardExpiry, giftCardStatus } from "../lib/gift-cards";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/admin/gift-cards/route";

const body = { customerEmail: "Buyer@Example.test", code: "zwgc-test12345678", amount: 500.25, expiresOn: "" };
const request = (data: unknown = body, origin = "https://store.example") => new Request("https://store.example/api/admin/gift-cards", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(data) });

test("gift-card input normalizes code/email and rejects invalid amounts and codes", () => {
  assert.equal(giftCardSchema.parse(body).code, "ZWGC-TEST12345678");
  assert.equal(giftCardSchema.parse(body).customerEmail, "buyer@example.test");
  for (const patch of [{ amount: 0 }, { amount: -1 }, { amount: 1.001 }, { amount: 100001 }, { amount: Infinity }, { code: "short" }, { code: "bad code 123" }, { customerEmail: "bad" }]) assert.equal(giftCardSchema.safeParse({ ...body, ...patch }).success, false);
});

test("expiry uses end-of-day India time and rejects past or impossible dates", () => {
  const now = Date.parse("2026-11-03T12:00:00Z");
  assert.equal(giftCardExpiry("2026-11-03", now)?.toISOString(), "2026-11-03T18:29:59.999Z");
  assert.equal(giftCardExpiry("", now), null);
  for (const value of ["2026-11-02", "2026-02-30", "not-a-date"]) assert.throws(() => giftCardExpiry(value, now));
  assert.equal(giftCardStatus({ balance: 500, expiresAt: "2026-11-03T18:29:59.999Z" }, now), "Issued");
  assert.equal(giftCardStatus({ balance: 500, expiresAt: "2026-11-02T18:29:59.999Z" }, now), "Expired");
  assert.equal(giftCardStatus({ balance: 0, expiresAt: null }, now), "No balance");
});

test("only admins may issue cards and cross-origin writes are blocked", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  assert.equal((await POST(request())).status, 401);
  for (const role of ["CUSTOMER", "SUPPLIER", "MANAGER"] as const) {
    actor.mock.mockImplementation(async () => ({ id: "u", fullName: "User", email: "u@example.test", role, isActive: true }));
    assert.equal((await POST(request())).status, 403);
  }
  actor.mock.mockImplementation(async () => ({ id: "admin", fullName: "Admin", email: "a@example.test", role: "ADMIN", isActive: true }));
  assert.equal((await POST(request(body, "https://other.example"))).status, 403);
});

test("issuance binds the card to an active customer and records an audit without exposing the code there", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "admin", fullName: "Admin", email: "a@example.test", role: "ADMIN", isActive: true }));
  let found = true, collision = false, saved: Record<string, unknown> = {}, audit: Record<string, unknown> = {};
  const tx = { user: { findFirst: async ({ where }: { where: Record<string, unknown> }) => {
    assert.equal(where.role, "CUSTOMER"); assert.equal(where.isActive, true);
    return found ? { id: "customer", fullName: "Buyer", email: "buyer@example.test" } : null;
  } }, customerVoucher: { create: async ({ data }: { data: typeof saved }) => { if (collision) throw { code: "P2002" }; saved = data; return { id: "card", ...data }; } }, auditLog: { create: async ({ data }: { data: typeof audit }) => { audit = data; } } };
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal((await POST(request())).status, 201);
  assert.equal(saved.customerId, "customer"); assert.equal(saved.balance, "500.25");
  assert.equal(audit.action, "ISSUE_GIFT_CARD"); assert.doesNotMatch(JSON.stringify(audit), /ZWGC-TEST12345678/);
  collision = true; assert.equal((await POST(request())).status, 409);
  found = false; assert.equal((await POST(request())).status, 404);
  assert.equal((await POST(request({ ...body, amount: 0 }))).status, 400);
});
