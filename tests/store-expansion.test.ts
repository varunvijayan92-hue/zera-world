import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";
import { priceCheckout } from "../lib/checkout";
import { normalizeCart } from "../lib/cart";
import { checkoutRequestSchema } from "../lib/validators";
import { returnEligibility } from "../lib/returns";
import { encryptCredentials, decryptCredentials } from "../lib/integration-crypto";
import { reportPeriod, csvCell } from "../lib/finance-report";
import { POST as requestReturn } from "../app/api/account/returns/route";
import { POST as supplierAction } from "../app/api/supplier/actions/route";
import { POST as saveIntegration } from "../app/api/admin/integrations/route";
import { POST as confirmDelivery } from "../app/api/admin/orders/[id]/delivery/route";
import { POST as requestRefund } from "../app/api/admin/returns/[id]/refund/route";
import { razorpayGateway } from "../lib/razorpay";
import { saveReturnRefund } from "../lib/return-refund";
import { buildSupplierOrderEmailText } from "../lib/email";

function identity(t: TestContext, role: UserRole = "CUSTOMER") {
  t.mock.method(authContext, "current", async () => ({ id: "actor", email: "actor@example.test", fullName: "Actor", isActive: true, role }));
}
function model(t: TestContext, name: string, methods: Record<string, unknown>) {
  const target = prisma as unknown as Record<string, unknown>; const previous = target[name];
  target[name] = methods; t.after(() => { target[name] = previous; });
}
function transaction(t: TestContext) {
  const previous = prisma.$transaction;
  Object.assign(prisma, { $transaction: async (operation: (client: typeof prisma) => unknown) => operation(prisma) });
  t.after(() => Object.assign(prisma, { $transaction: previous }));
}
function post(body: unknown, origin = "http://localhost") { return new Request("http://localhost/api/test", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) }); }

test("the ten-unit cap applies across products in browser normalization and server validation", () => {
  const item = { id: "a", name: "A", sku: "A", sellingPrice: 100, quantity: 8 };
  const cart = normalizeCart([item, { ...item, id: "b", sku: "B", quantity: 5 }]);
  assert.equal(cart.reduce((sum, row) => sum + row.quantity, 0), 10);
  const excessive = [{ productId: "a", sku: "A", quantity: 8 }, { productId: "b", sku: "B", quantity: 3 }];
  assert.equal(checkoutRequestSchema.shape.cart.safeParse(excessive).success, false);
  assert.throws(() => priceCheckout(excessive, []), /limit/);
});
test("checkout uses each product's GST and per-unit handling rather than a cart-wide tax rate", () => {
  const inventory = [{ availableQty: 100, reservedQty: 0 }];
  const result = priceCheckout([{ productId: "a", sku: "A", quantity: 2 }, { productId: "b", sku: "B", quantity: 1 }], [
    { id: "a", sku: "A", status: "ACTIVE", sellingPrice: 100, gstRate: 18, handlingCharge: 3, inventory },
    { id: "b", sku: "B", status: "ACTIVE", sellingPrice: 200, gstRate: 5, handlingCharge: 5, inventory },
  ]);
  assert.deepEqual(result, { subtotal: 400, taxes: 46, handlingCharges: 11, shippingCharges: 0, total: 457, currency: "INR" });
});
test("supplier order emails include customer details, item lines and invoice totals", () => {
  const text = buildSupplierOrderEmailText({
    supplierCompany: "Leaf & Loom",
    supplierContact: "Asha",
    orderId: "ORDER-123",
    customer: { fullName: "Rahul Sharma", email: "rahul@example.com", phone: "9999999999" },
    shippingAddress: {
      addressLine1: "42 Market Road",
      addressLine2: "Near City Plaza",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
    },
    items: [
      { productName: "Cotton Kurta", sku: "CT-KURTA-01", quantity: 2, unitPrice: 2500, gstRate: 18, handlingCharge: 25, lineTotal: 5900 },
      { productName: "Silk Scarf", sku: "SCARF-XL", quantity: 1, unitPrice: 1200, gstRate: 5, handlingCharge: 15, lineTotal: 1260 },
    ],
    totals: { subtotal: 6200, taxes: 960, handling: 65, shipping: 120, total: 7345 },
  });
  assert.match(text, /Rahul Sharma/);
  assert.match(text, /42 Market Road/);
  assert.match(text, /Cotton Kurta/);
  assert.match(text, /Subtotal: ₹6,200\.00/);
  assert.match(text, /Total for Leaf & Loom: ₹7,345\.00/);
});
test("return windows start at delivery and reject nonreturnable, expired and legacy unknown policies", () => {
  const delivered = new Date("2026-10-01T10:00:00Z"); const policy = { isReturnable: true, returnDays: 7 };
  assert.equal(returnEligibility(policy, null), "Returns are available after delivery is confirmed.");
  assert.equal(returnEligibility(policy, delivered, new Date("2026-10-08T10:00:00Z")), null);
  assert.match(returnEligibility(policy, delivered, new Date("2026-10-08T10:00:00.001Z"))!, /closed/);
  assert.match(returnEligibility({ ...policy, isReturnable: false }, delivered)!, /not returnable/);
  assert.match(returnEligibility({ isReturnable: null, returnDays: null }, delivered)!, /not returnable/);
});
test("API secrets are authenticated encrypted values and fail closed with a missing or changed key", () => {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  try {
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const credentials = { apiToken: "private-token-test-only" }; const encrypted = encryptCredentials(credentials);
    assert.equal(encrypted.includes(credentials.apiToken), false); assert.deepEqual(decryptCredentials(encrypted), credentials);
    process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64"); assert.throws(() => decryptCredentials(encrypted));
    delete process.env.INTEGRATION_ENCRYPTION_KEY; assert.throws(() => encryptCredentials(credentials));
  } finally { if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous; }
});
test("report date bounds include the entire final India day and CSV cells cannot execute formulas", () => {
  const period = reportPeriod("2026-10-01", "2026-10-02");
  assert.equal(period.range.gte.toISOString(), "2026-09-30T18:30:00.000Z");
  assert.equal(period.range.lt.toISOString(), "2026-10-02T18:30:00.000Z");
  for (const values of [["2026-02-30", "2026-03-01"], ["2026-11-01", "2026-10-01"], ["2024-01-01", "2026-01-01"]]) assert.throws(() => reportPeriod(...values));
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"'); assert.equal(csvCell("a,b"), '"a,b"');
});
test("customer returns bind ownership to the session and enforce cumulative returned quantities", async (t) => {
  identity(t); transaction(t); let found = false; let requested = 0; let created: unknown;
  model(t, "orderItem", { findFirst: async (args: { where: { customerOrder: { customerId: string; status: string } } }) => {
    assert.equal(args.where.customerOrder.customerId, "actor"); assert.equal(args.where.customerOrder.status, "DELIVERED");
    return found ? { id: "line", quantity: 2, isReturnable: true, returnDays: 7, customerOrderId: "order", supplierId: null, customerOrder: { deliveredAt: new Date() } } : null;
  } });
  model(t, "returnRequest", { aggregate: async () => ({ _sum: { quantity: requested } }), create: async (args: unknown) => { created = args; return {}; } });
  const body = { orderItemId: "line", quantity: 1, reason: "The product arrived damaged", customerId: "other-customer" };
  assert.equal((await requestReturn(post(body))).status, 404); found = true; requested = 2;
  assert.equal((await requestReturn(post(body))).status, 400); assert.equal(created, undefined);
  requested = 1; assert.equal((await requestReturn(post(body))).status, 201);
  assert.equal((created as unknown as { data: { customerId: string } }).data.customerId, "actor");
});
test("supplier mutations reject customer roles and query only the authenticated supplier's item", async (t) => {
  identity(t, "CUSTOMER");
  assert.equal((await supplierAction(post({ action: "ORDER", itemId: "foreign", status: "ACCEPTED" }))).status, 403);
  t.mock.restoreAll(); identity(t, "SUPPLIER"); transaction(t);
  model(t, "supplierContact", { findFirst: async (args: { where: { userId: string; supplier: { sourceType: string } } }) => { assert.equal(args.where.userId, "actor"); assert.equal(args.where.supplier.sourceType, "DIRECT"); return { supplier: { id: "own-supplier" } }; } });
  model(t, "orderItem", { findFirst: async (args: { where: { supplierId: string } }) => { assert.equal(args.where.supplierId, "own-supplier"); return null; } });
  assert.equal((await supplierAction(post({ action: "ORDER", itemId: "foreign", status: "ACCEPTED" }))).status, 404);
});
test("only administrators can save API credentials and cross-origin writes are rejected", async (t) => {
  identity(t, "MANAGER"); assert.equal((await saveIntegration(post({ provider: "RAZORPAY", credentials: {} }))).status, 403);
  t.mock.restoreAll(); identity(t, "ADMIN"); assert.equal((await saveIntegration(post({ provider: "RAZORPAY", credentials: {} }, "https://foreign.test"))).status, 403);
});
test("delivery confirmation requires a verified paid order and rejects resetting the delivery clock", async (t) => {
  identity(t, "ADMIN"); transaction(t); let deliveredAt: Date | null = null;
  model(t, "customerOrder", { findUnique: async () => ({ id: "order", status: "SHIPPED", deliveredAt }) });
  model(t, "paymentTransaction", { findFirst: async () => null });
  const params = { params: Promise.resolve({ id: "order" }) };
  assert.equal((await confirmDelivery(post({}), params)).status, 400);
  deliveredAt = new Date(); assert.equal((await confirmDelivery(post({}), params)).status, 409);
});
test("a duplicate return refund never sends another request to Razorpay", async (t) => {
  identity(t, "ADMIN"); transaction(t);
  model(t, "returnRequest", { findUnique: async () => ({ id: "return", status: "COMPLETED", receivedAt: new Date(), orderItemId: "line", refunds: [{ id: "existing" }] }) });
  const gateway = t.mock.method(razorpayGateway, "refund", async () => { throw Error("Must not transfer money"); });
  assert.equal((await requestRefund(post({}), { params: Promise.resolve({ id: "return" }) })).status, 409); assert.equal(gateway.mock.callCount(), 0);
});

test("processed return refunds update partial payment status and cannot be downgraded by stale results", async (t) => {
  transaction(t); let status = "PENDING"; const paymentWrites: unknown[] = [];
  model(t, "refund", {
    findUnique: async () => ({ id: "r", amount: 105, currency: "INR", status, returnRequest: { customerOrderId: "order" } }),
    update: async (args: { data: { status: string } }) => { status = args.data.status; return {}; },
    aggregate: async () => ({ _sum: { amount: 105 } }),
  });
  model(t, "paymentTransaction", { findFirst: async () => ({ id: "payment", amount: 225 }), updateMany: async (args: unknown) => { paymentWrites.push(args); return { count: 1 }; } });
  const gateway = { id: "rfnd_test", payment_id: "pay_test", amount: 10500, currency: "INR", status: "processed" };
  await saveReturnRefund("r", gateway); assert.equal(status, "SUCCESS");
  assert.equal((paymentWrites[0] as { data: { paymentStatus: string } }).data.paymentStatus, "PARTIALLY_REFUNDED");
  await saveReturnRefund("r", { ...gateway, status: "pending" }); assert.equal(status, "SUCCESS"); assert.equal(paymentWrites.length, 1);
  await assert.rejects(() => saveReturnRefund("r", { ...gateway, amount: 1 }), /does not match/);
});

test("a supplier cannot confirm receipt of another supplier's return", async (t) => {
  identity(t, "SUPPLIER"); transaction(t);
  model(t, "supplierContact", { findFirst: async () => ({ supplier: { id: "own-supplier" } }) });
  model(t, "returnRequest", { findFirst: async (args: { where: { supplierId: string } }) => { assert.equal(args.where.supplierId, "own-supplier"); return null; } });
  assert.equal((await supplierAction(post({ action: "RETURN_RECEIVED", returnId: "foreign-return" }))).status, 404);
});
