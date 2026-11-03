import assert from "node:assert/strict";
import test from "node:test";
import { customerOrderTracking } from "../lib/customer-tracking";
import { GET } from "../app/api/account/route";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";

test("tracking stays with the matching dispatch group and hides private supplier IDs", () => {
  const result = customerOrderTracking({ id: "o", orderItems: [{ id: "a", supplierId: "PRIVATE-A" }, { id: "b", supplierId: "PRIVATE-B" }, { id: "c", supplierId: "PRIVATE-A" }], shipments: [{ id: "s1", supplierId: "PRIVATE-A" }, { id: "s2", supplierId: "PRIVATE-B" }, { id: "legacy", supplierId: null }] });
  assert.deepEqual(result.orderItems[0].shipments.map(row => row.id), ["s1"]);
  assert.equal(result.orderItems[0].shipments[0].shared, true);
  assert.deepEqual(result.orderItems[1].shipments.map(row => row.id), ["s2"]);
  assert.equal(result.orderItems[1].shipments[0].shared, false);
  assert.deepEqual(result.unassignedShipments.map(row => row.id), ["legacy"]);
  assert.doesNotMatch(JSON.stringify(result), /supplierId|PRIVATE-/);
});

test("single-item legacy shipments can be displayed without guessing across multiple products", () => {
  const result = customerOrderTracking({ orderItems: [{ id: "a", supplierId: null }], shipments: [{ id: "s", supplierId: null }] });
  assert.equal(result.orderItems[0].shipments[0].id, "s");
  assert.equal(result.unassignedShipments.length, 0);
});

test("account tracking requires a customer and queries only their orders", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  assert.equal((await GET()).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "a", role: "ADMIN", email: "a@example.test", fullName: "Admin", isActive: true }));
  assert.equal((await GET()).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "c", role: "CUSTOMER", email: "c@example.test", fullName: "Customer", isActive: true }));
  const original = { user: prisma.user, customerAddress: prisma.customerAddress, supportTicket: prisma.supportTicket, customerVoucher: prisma.customerVoucher, paymentTransaction: prisma.paymentTransaction, customerOrder: prisma.customerOrder };
  t.after(() => Object.assign(prisma, original));
  Object.assign(prisma, { user: { findUnique: async () => ({ fullName: "Customer" }) }, customerAddress: { findMany: async () => [] }, supportTicket: { findMany: async () => [] }, customerVoucher: { findMany: async () => [] }, paymentTransaction: { findMany: async () => [] }, customerOrder: { findMany: async (args: { where: { customerId: string } }) => {
    assert.equal(args.where.customerId, "c");
    return [{ id: "o", orderItems: [{ id: "i", supplierId: "PRIVATE-A" }], shipments: [{ id: "s", supplierId: "PRIVATE-A", trackingEvents: [{ eventType: "IN_TRANSIT" }] }] }];
  } } });
  const response = await GET(); assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.orders[0].orderItems[0].shipments[0].trackingEvents[0].eventType, "IN_TRANSIT");
  assert.doesNotMatch(JSON.stringify(body), /supplierId|PRIVATE-A/);
});
