import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/mobile/admin/actions/route";

function request(body: unknown, origin = "http://localhost") {
  return new Request("http://localhost/api/mobile/admin/actions", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
}
function transaction(t: TestContext, work: (...args: any[]) => any) {
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: work });
  t.after(() => Object.assign(prisma, { $transaction: original }));
}
function actor(t: TestContext, role: "ADMIN" | "MANAGER" = "ADMIN") {
  t.mock.method(authContext, "current", async () => ({ id: "admin", role, email: "admin@test.local", fullName: "Admin", isActive: true }));
}

test("mobile COD rejects undelivered orders and records one receipt against the existing payment", async t => {
  actor(t);
  let delivered = false, paid = false, writes = 0, audits = 0;
  const tx = {
    customerOrder: { findUnique: async () => ({ status: delivered ? "DELIVERED" : "CONFIRMED", deliveredAt: delivered ? new Date() : null, totalAmount: 100 }) },
    paymentTransaction: { findFirst: async () => ({ id: "pay", provider: "COD", amount: 100, paymentStatus: paid ? "PAID" : "PENDING" }), update: async ({ data }: any) => { assert.equal(data.gatewayPaymentId, "COD:RECEIPT-1"); paid = true; writes++; } },
    auditLog: { create: async () => { audits++; } },
  };
  transaction(t, async (work: any, options: any) => { assert.equal(options.isolationLevel, "Serializable"); return work(tx); });
  const body = { action: "COD_COLLECTION", orderId: "order", reference: "RECEIPT-1" };
  assert.equal((await POST(request(body))).status, 400);
  assert.equal(writes, 0);
  delivered = true;
  assert.equal((await POST(request(body))).status, 200);
  assert.equal((await POST(request(body))).status, 200);
  assert.equal(writes, 1); assert.equal(audits, 1);
  assert.equal((await POST(request(body, "https://evil.test"))).status, 403);
});

test("mobile completion requires approved return and records physical receipt", async t => {
  actor(t);
  let status = "OPEN", received = false;
  transaction(t, async (work: any) => work({
    returnRequest: { findUnique: async () => ({ status }), update: async ({ data }: any) => { status = data.status; received = data.receivedAt instanceof Date; } },
    auditLog: { create: async () => ({}) },
  }));
  const body = { action: "RETURN_REVIEW", returnId: "return", decision: "COMPLETED" };
  assert.equal((await POST(request(body))).status, 409);
  assert.equal(received, false);
  status = "APPROVED";
  assert.equal((await POST(request(body))).status, 200);
  assert.equal(received, true);
  assert.equal(status, "COMPLETED");
  assert.equal((await POST(request(body))).status, 409);
});

test("mobile user changes protect admin access and revoke target sessions", async t => {
  actor(t);
  let target = { id: "admin", role: "ADMIN", isActive: true }, writes = 0;
  transaction(t, async (work: any) => work({
    user: { findUnique: async () => target, count: async () => 1, update: async ({ data }: any) => { assert.deepEqual(data.sessionVersion, { increment: 1 }); writes++; } },
    auditLog: { create: async () => ({}) },
  }));
  assert.equal((await POST(request({ action: "USER_STATUS", userId: "admin", isActive: false }))).status, 400);
  target = { id: "another-admin", role: "ADMIN", isActive: true };
  assert.equal((await POST(request({ action: "USER_STATUS", userId: target.id, isActive: false }))).status, 400);
  target = { id: "staff", role: "STAFF", isActive: true };
  assert.equal((await POST(request({ action: "USER_STATUS", userId: target.id, isActive: false }))).status, 200);
  assert.equal(writes, 1);
});

test("mobile managers cannot change user access and stock cannot undercut reservations", async t => {
  actor(t, "MANAGER");
  let writes = 0;
  transaction(t, async (work: any) => work({
    product: { findUnique: async () => ({ inventory: [{ id: "stock", reservedQty: 5 }] }) },
    inventory: { update: async () => { writes++; } },
    auditLog: { create: async () => ({}) },
  }));
  assert.equal((await POST(request({ action: "USER_STATUS", userId: "staff", isActive: false }))).status, 403);
  assert.equal((await POST(request({ action: "INVENTORY_UPDATE", productId: "p", availableQty: 4 }))).status, 409);
  assert.equal((await POST(request({ action: "PRODUCT_UPDATE", productId: "p", stock: 4 }))).status, 409);
  assert.equal(writes, 0);
  assert.equal((await POST(request({ action: "CJ_SYNC", syncType: "orders" }))).status, 409);
});

test("mobile order status cannot revive terminal orders or fulfil an unpaid order", async t => {
  actor(t);
  let status = "DELIVERED", paid = false, writes = 0;
  transaction(t, async (work: any) => work({
    customerOrder: { findUnique: async () => ({ id: "order", status }), update: async () => { writes++; } },
    paymentTransaction: { findFirst: async () => paid ? { id: "payment" } : null },
    auditLog: { create: async () => ({}) },
  }));
  const body = { action: "ORDER_STATUS", orderId: "order", status: "PROCESSING" };
  assert.equal((await POST(request(body))).status, 409);
  status = "CONFIRMED";
  assert.equal((await POST(request(body))).status, 409);
  paid = true;
  assert.equal((await POST(request(body))).status, 200);
  assert.equal(writes, 1);
  assert.equal((await POST(request({ ...body, status: "CANCELLED" }))).status, 409);
  assert.equal(writes, 1);
});
