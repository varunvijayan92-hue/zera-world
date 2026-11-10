import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { cashOnDeliveryAvailable, fulfilmentPaymentWhere, codShippingShare, supplierCodTotal } from "../lib/cash-on-delivery";
import { prisma } from "../lib/prisma";
import { authContext, AUTH_COOKIE } from "../lib/auth";
import { emailDelivery } from "../lib/email";
import { razorpayGateway } from "../lib/razorpay";
import { POST as checkout } from "../app/api/create-order/route";
import { POST as collect } from "../app/api/admin/orders/[id]/cod-collection/route";
import { POST as delivery } from "../app/api/admin/orders/[id]/delivery/route";

const shippingAddress = { fullName: "Customer", email: "customer@example.test", phone: "9999999999", addressLine1: "Test street", city: "Kochi", state: "Kerala", pincode: "682001", country: "India" };
const body = { cart: [{ productId: "p1", sku: "SKU", quantity: 1 }], shippingAddress, paymentMethod: "cod", expectedTotalPaise: 10500, idempotencyKey: "cod-unit-request-123456" };
const request = (data: unknown, origin = "https://store.example") => new Request("https://store.example/api/create-order", { method: "POST", headers: { origin, "Content-Type": "application/json", cookie: `${AUTH_COOKIE}=unit` }, body: JSON.stringify(data) });

test("multi-supplier COD collection totals allocate shipping once with deterministic paise rounding", () => {
  const order = { shippingAmount: 120.01, orderItems: ["s2", "s1"].map(supplierId => ({ supplierId, quantity: 1, unitPrice: 100, gstRate: 5, handlingCharge: 0 })) };
  assert.equal(codShippingShare(120.01, ["s2", "s1"], "s1"), 60.01);
  assert.equal(supplierCodTotal(order, "s1"), 165.01);
  assert.equal(supplierCodTotal(order, "s2"), 165);
  assert.equal(supplierCodTotal(order, "s1") + supplierCodTotal(order, "s2"), 330.01);
});

function setup(t: TestContext) {
  let created = false;
  const product = { id: "p1", sku: "SKU", name: "Product", status: "ACTIVE", supplierId: "s1", supplier: { status: "ACTIVE", sourceType: "DIRECT", codHandling: "OWN_COURIER" }, sellingPrice: 100, costPrice: 40, gstRate: 5, handlingCharge: 0, codAvailable: true, inventory: [{ availableQty: 5, reservedQty: 0 }], imageUrls: [] };
  const order = { id: "o1", marketplaceOrderId: "ORDER-UNIT", status: "CONFIRMED", customerId: "customer1", totalAmount: 105, shippingAmount: 0, shippingAddress, orderItems: [{ productId: "p1", supplierId: "s1", marketplaceSku: "SKU", quantity: 1, unitPrice: 100, gstRate: 5, handlingCharge: 0 }] };
  let orderData: Record<string, unknown> = {}, paymentData: Record<string, unknown> = {};
  const original = { product: prisma.product, customerOrder: prisma.customerOrder, paymentTransaction: prisma.paymentTransaction, supplier: prisma.supplier, transaction: prisma.$transaction };
  Object.assign(prisma, {
    product: { findMany: async (args: { where?: { supplier?: { provider?: string } } }) => args.where?.supplier?.provider === "CJ_DROPSHIPPING" ? [] : [product] },
    customerOrder: { create: async ({ data }: { data: typeof orderData }) => { orderData = data; return order; }, findFirst: async ({ where }: { where: { customerId: string } }) => where.customerId === order.customerId ? order : null },
    paymentTransaction: { findUnique: async () => created ? { orderId: "o1", provider: "COD", paymentStatus: "PENDING" } : null, create: async ({ data }: { data: typeof paymentData }) => { paymentData = data; created = true; return { id: "payment1" }; } },
    supplier: { findMany: async () => [{ id: "s1", companyName: "Supplier", email: "supplier@example.test" }] },
    $transaction: async (operation: (client: typeof prisma) => unknown) => operation(prisma),
  });
  t.after(() => Object.assign(prisma, { product: original.product, customerOrder: original.customerOrder, paymentTransaction: original.paymentTransaction, supplier: original.supplier, $transaction: original.transaction }));
  const actor = t.mock.method(authContext, "current", async () => ({ id: "customer1", email: shippingAddress.email, fullName: "Customer", role: "CUSTOMER", isActive: true }));
  const email = t.mock.method(emailDelivery, "send", async () => ({ accepted: true }));
  const gateway = t.mock.method(razorpayGateway, "createOrder", async () => { throw Error("COD must never call Razorpay"); });
  return { product, order, actor, email, gateway, orderData: () => orderData, paymentData: () => paymentData };
}

test("COD requires each product and active supplier to have an enabled collection arrangement", () => {
  const product = { codAvailable: true, supplierId: "s1", supplier: { status: "ACTIVE", sourceType: "DIRECT", codHandling: "OWN_COURIER" } };
  assert.equal(cashOnDeliveryAvailable([product]), true);
  assert.equal(cashOnDeliveryAvailable([{ ...product, supplier: { status: "ACTIVE", sourceType: "EXTERNAL_SITE", codHandling: "SUPPLIER_COURIER" } }]), true);
  assert.equal(cashOnDeliveryAvailable([]), false);
  for (const ineligible of [{ ...product, codAvailable: false }, { ...product, supplierId: null }, { ...product, supplier: { status: "INACTIVE", sourceType: "DIRECT", codHandling: "OWN_COURIER" } }, { ...product, supplier: { status: "ACTIVE", sourceType: "EXTERNAL_SITE", codHandling: "NONE" } }]) assert.equal(cashOnDeliveryAvailable([product, ineligible]), false);
  assert.deepEqual(fulfilmentPaymentWhere("o1"), { orderId: "o1", OR: [{ paymentStatus: "PAID" }, { provider: "COD", paymentStatus: "PENDING" }] });
});

test("COD creates a confirmed supplier order with pending collection and never opens a gateway payment", async t => {
  const state = setup(t);
  const response = await checkout(request(body)); assert.equal(response.status, 201);
  assert.equal(state.orderData().status, "CONFIRMED");
  assert.equal(state.paymentData().provider, "COD"); assert.equal(state.paymentData().paymentStatus, "PENDING");
  assert.equal(state.paymentData().amount, 105); assert.equal(state.gateway.mock.callCount(), 0);
  assert.equal(state.email.mock.callCount(), 1);
  const result = await response.json(); assert.equal(result.data.payment.provider, "COD"); assert.equal(result.amount, 10500);
  const repeated = await checkout(request(body)); assert.equal(repeated.status, 200);
  assert.equal((await repeated.json()).data.order.id, "o1"); assert.equal(state.email.mock.callCount(), 1);
  assert.equal((await checkout(request({ ...body, cart: [{ productId: "p1", sku: "SKU", quantity: 2 }] }))).status, 409);
  state.actor.mock.mockImplementation(async () => ({ id: "customer2", email: "other@example.test", fullName: "Other", role: "CUSTOMER", isActive: true }));
  assert.equal((await checkout(request(body))).status, 409);
});

test("COD checkout validates and saves the customer's colour and size", async t => {
  const state = setup(t);
  Object.assign(state.product, { color: "Olive, Peach", size: "66 cm, 80 cm" });
  const selected = { ...body, cart: [{ productId: "p1", sku: "SKU", quantity: 1, selectedColor: "Peach", selectedSize: "80 cm" }] };
  const response = await checkout(request(selected));
  assert.equal(response.status, 201);
  const lines = state.orderData().orderItems as { create: Array<{ selectedColor: string; selectedSize: string }> };
  assert.equal(lines.create[0].selectedColor, "Peach");
  assert.equal(lines.create[0].selectedSize, "80 cm");
});

test("COD checks current eligibility, current totals, same-origin and submission reference before creating an order", async t => {
  const state = setup(t); state.product.codAvailable = false;
  assert.equal((await checkout(request(body))).status, 400);
  assert.deepEqual(state.orderData(), {}); state.product.codAvailable = true;
  assert.equal((await checkout(request({ ...body, expectedTotalPaise: 100 }))).status, 409);
  assert.equal((await checkout(request({ ...body, idempotencyKey: undefined }))).status, 400);
  assert.equal((await checkout(request(body, "https://evil.example"))).status, 403);
  assert.equal(state.gateway.mock.callCount(), 0); assert.deepEqual(state.orderData(), {});
});

test("customers cannot record COD cash receipts and cross-origin receipt requests are blocked", async t => {
  const state = setup(t);
  const params = { params: Promise.resolve({ id: "o1" }) };
  assert.equal((await collect(request({ reference: "RECEIPT-1" }), params)).status, 403);
  state.actor.mock.mockImplementation(async () => ({ id: "admin", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  assert.equal((await collect(request({ reference: "RECEIPT-1" }, "https://evil.example"), params)).status, 403);
});

test("COD delivery does not mark cash paid; receipt recording needs admin, delivered order and a reference", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "admin", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  const original = prisma.$transaction;
  let status = "CONFIRMED", deliveredAt: Date | null = null, paid = false, audits = 0;
  const tx = {
    customerOrder: { findUnique: async () => ({ status, deliveredAt, totalAmount: 225 }), update: async () => { status = "DELIVERED"; deliveredAt = new Date(); } },
    paymentTransaction: { findFirst: async ({ where }: { where: { OR?: unknown; provider?: string } }) => where.OR || where.provider === "COD" ? { id: "pay1", amount: 225, paymentStatus: paid ? "PAID" : "PENDING", provider: "COD" } : null, update: async () => { paid = true; } },
    auditLog: { create: async () => { audits++; } },
  };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  const params = { params: Promise.resolve({ id: "o1" }) };
  assert.equal((await collect(request({ reference: "COURIER-RECEIPT" }), params)).status, 400);
  assert.equal((await delivery(request({}), params)).status, 200); assert.equal(paid, false);
  assert.equal((await collect(request({}), params)).status, 400);
  assert.equal((await collect(request({ reference: "COURIER-RECEIPT" }), params)).status, 200); assert.equal(paid, true);
  assert.equal((await collect(request({ reference: "COURIER-RECEIPT" }), params)).status, 200); assert.equal(audits, 2);
});
