import { authContext, AUTH_COOKIE } from "../lib/auth";
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { integrationStore } from "../lib/integration-settings";
import { prisma } from "../lib/prisma";
import { POST as verifyPayment } from "../app/api/verify-payment/route";
import { POST as createOrder } from "../app/api/create-order/route";
import { generateRazorpayWebhookSignature } from "../lib/payment";
import { assertOrderAmount, gatewayError, GatewayError, razorpayGateway } from "../lib/razorpay";

const unitSecret = "unit-test-secret-not-a-real-credential";
const transaction = {
  id: "tx1", orderId: "local1", gatewayOrderId: "order_test1", gatewayPaymentId: null,
  amount: 329.98, currency: "INR", paymentStatus: "PENDING", provider: "RAZORPAY",
};
const capturedPayment = {
  id: "pay_test1", order_id: "order_test1", amount: 32998, currency: "INR", status: "captured",
};
const fields = {
  razorpay_order_id: "order_test1", razorpay_payment_id: "pay_test1",
  razorpay_signature: generateRazorpayWebhookSignature({ payload: "order_test1|pay_test1", secret: unitSecret }),
};

function request(body: unknown) {
  return new Request("http://localhost/api/verify-payment", { method: "POST", headers: { cookie: `${AUTH_COOKIE}=test` }, body: JSON.stringify(body) });
}

function setup(t: TestContext) {
  t.mock.method(authContext, "current", async () => ({ id: "customer1", email: "test@example.com", fullName: "Test", role: "CUSTOMER", isActive: true }));
  t.mock.method(integrationStore, "find", async () => null);
  // Prisma exposes model delegates through proxies; replace the delegates with
  // plain stubs so node:test can track method calls without opening a database.
  const originalDelegates = { paymentTransaction: prisma.paymentTransaction, customerOrder: prisma.customerOrder, product: prisma.product, orderItem: prisma.orderItem, syncJob: prisma.syncJob };
  Object.assign(prisma, {
    paymentTransaction: {
      findFirst: async () => null, findUnique: async () => null, findUniqueOrThrow: async () => ({}),
      update: async () => ({}), create: async () => ({}),
    },
    customerOrder: { updateMany: async () => ({ count: 0 }), create: async () => ({}) },
    product: { findMany: async () => [] },
    orderItem: { findFirst: async () => null },
    syncJob: { upsert: async () => ({}) },
  });
  t.after(() => Object.assign(prisma, originalDelegates));
  const previous = { key: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
  process.env.RAZORPAY_KEY_ID = "rzp_test_unit";
  process.env.RAZORPAY_KEY_SECRET = unitSecret;
  t.after(() => {
    if (previous.key === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = previous.key;
    if (previous.secret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = previous.secret;
  });
  const find = t.mock.method(prisma.paymentTransaction, "findFirst", async (): Promise<typeof transaction | null> => ({ ...transaction }));
  t.mock.method(prisma.paymentTransaction, "findUniqueOrThrow", async () => ({ ...transaction }));
  const update = t.mock.method(prisma.paymentTransaction, "update", async () => ({}));
  const confirm = t.mock.method(prisma.customerOrder, "updateMany", async () => ({ count: 1 }));
  const originalTransaction = prisma.$transaction;
  t.after(() => Object.assign(prisma, { $transaction: originalTransaction }));
  Object.assign(prisma, { $transaction: async (operation: unknown) => {
    if (typeof operation === "function") return operation(prisma);
    return Promise.all(operation as Promise<unknown>[]);
  } });
  const fetch = t.mock.method(razorpayGateway, "fetchPayment", async () => ({ ...capturedPayment }));
  return { find, update, confirm, fetch };
}

test("order amounts require integer paise and a minimum of INR 1", () => {
  for (const amount of [0, 99, -100, 100.5, NaN, Infinity]) assert.throws(() => assertOrderAmount(amount));
  assert.doesNotThrow(() => assertOrderAmount(100));
  assert.equal(gatewayError({ statusCode: 401 }).status, 401);
  assert.equal(gatewayError({ statusCode: 503 }).status, 500);
});

test("verification rejects missing fields and forged signatures without payment writes", async (t) => {
  const { fetch, update, confirm } = setup(t);
  assert.equal((await verifyPayment(request({}))).status, 400);
  assert.equal((await verifyPayment(request({ ...fields, razorpay_signature: "0".repeat(64) }))).status, 400);
  assert.equal(fetch.mock.callCount(), 0);
  assert.equal(update.mock.callCount(), 0);
  assert.equal(confirm.mock.callCount(), 0);
});

test("captured verified payment updates the payment and confirms the local order", async (t) => {
  const { update, confirm } = setup(t);
  const response = await verifyPayment(request(fields));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, order_id: "local1", payment_status: "PAID" });
  assert.equal(update.mock.callCount(), 1);
  assert.equal(confirm.mock.callCount(), 1);
});

test("authorized payment verifies successfully but is not marked paid", async (t) => {
  const { fetch, confirm } = setup(t);
  fetch.mock.mockImplementation(async () => ({ ...capturedPayment, status: "authorized" }));
  const response = await verifyPayment(request(fields));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).payment_status, "AUTHORIZED");
  assert.equal(confirm.mock.callCount(), 0);
});

test("a valid signature cannot confirm a mismatched amount or gateway order", async (t) => {
  const { fetch, update, confirm } = setup(t);
  for (const patch of [{ amount: 100 }, { order_id: "order_other" }, { currency: "USD" }, { status: "failed" }]) {
    fetch.mock.mockImplementation(async () => ({ ...capturedPayment, ...patch }));
    assert.equal((await verifyPayment(request(fields))).status, 400);
  }
  assert.equal(update.mock.callCount(), 0);
  assert.equal(confirm.mock.callCount(), 0);
});

test("unknown orders and gateway authentication failures are handled safely", async (t) => {
  const { fetch, find, update } = setup(t);
  fetch.mock.mockImplementation(async () => { throw new GatewayError("Razorpay authentication failed.", 401); });
  assert.equal((await verifyPayment(request(fields))).status, 401);
  find.mock.mockImplementation(async () => null);
  assert.equal((await verifyPayment(request(fields))).status, 400);
  assert.equal(update.mock.callCount(), 0);
});

test("create-order uses persisted cart prices and returns gateway amounts in paise", async (t) => {
  setup(t);
  t.mock.method(prisma.paymentTransaction, "findUnique", async () => null);
  t.mock.method(prisma.product, "findMany", async (args: { where?: { supplier?: unknown } }) => args.where?.supplier ? [] : [{
    id: "p1", sku: "SKU", status: "ACTIVE", sellingPrice: 99.99,
    inventory: [{ availableQty: 10, reservedQty: 0 }],
  }]);
  t.mock.method(prisma.customerOrder, "create", async () => ({ id: "local1", orderItems: [{ costPrice: 12.34, supplierId: "private-supplier" }] }));
  t.mock.method(prisma.paymentTransaction, "create", async () => ({ id: "tx1" }));
  const create = t.mock.method(razorpayGateway, "createOrder", async (input: { amount: number; currency: string; receipt: string }) => ({ id: "order_test1", ...input }));
  const response = await createOrder(request({
    cart: [{ productId: "p1", sku: "SKU", quantity: 2 }],
    shippingAddress: { fullName: "Test", email: "test@example.com", phone: "9999999999", addressLine1: "Street", city: "City", state: "State", pincode: "560001", country: "India" },
    paymentMethod: "razorpay", amount: 1,
  }));
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.order_id, "order_test1");
  assert.equal(result.amount, 20998);
  assert.equal(result.currency, "INR");
  assert.equal(create.mock.calls[0].arguments[0].amount, 20998);
  assert.equal(JSON.stringify(result).includes(unitSecret), false);
  assert.equal(JSON.stringify(result).includes("costPrice"), false);
  assert.equal(JSON.stringify(result).includes("private-supplier"), false);
});

test("a changed total requires fresh confirmation before an order or payment is created", async (t) => {
  setup(t);
  t.mock.method(prisma.paymentTransaction, "findUnique", async () => null);
  t.mock.method(prisma.product, "findMany", async (args: { where?: { supplier?: unknown } }) => args.where?.supplier ? [] : [{
    id: "p1", sku: "SKU", status: "ACTIVE", sellingPrice: 100,
    inventory: [{ availableQty: 10, reservedQty: 0 }],
  }]);
  const createLocal = t.mock.method(prisma.customerOrder, "create", async () => ({ id: "unused" }));
  const createGateway = t.mock.method(razorpayGateway, "createOrder", async () => { throw Error("Must not start payment"); });
  const result = await createOrder(request({
    cart: [{ productId: "p1", sku: "SKU", quantity: 1 }],
    shippingAddress: { fullName: "Test", email: "test@example.com", phone: "9999999999", addressLine1: "Street", city: "City", state: "State", pincode: "560001", country: "India" },
    paymentMethod: "razorpay", expectedTotalPaise: 100,
  }));
  assert.equal(result.status, 409);
  assert.equal(createLocal.mock.callCount(), 0);
  assert.equal(createGateway.mock.callCount(), 0);
});

test("checkout requires a customer login before creating orders", async (t) => {
  setup(t);
  const create = t.mock.method(prisma.customerOrder, "create", async () => ({}));
  t.mock.method(authContext, "current", async () => null);
  const response = await createOrder(request({ cart: [{ productId: "p1", sku: "SKU", quantity: 1 }], shippingAddress: { fullName: "Test", email: "test@example.com", phone: "9999999999", addressLine1: "Street", city: "City", state: "State", pincode: "560001", country: "India" }, paymentMethod: "razorpay" }));
  assert.equal(response.status, 401);
  assert.equal(create.mock.callCount(), 0);
});
