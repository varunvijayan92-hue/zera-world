import assert from "node:assert/strict";
import test from "node:test";
import { authContext, AUTH_COOKIE } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/payments/checkout/route";

test("every payment method rejects missing submission references before stock checks or writes", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "reference-test", email: "buyer@example.test", fullName: "Buyer", role: "CUSTOMER", isActive: true }));
  const original = { product: prisma.product, transaction: prisma.$transaction };
  const products = t.mock.fn(async () => { throw new Error("Must not query stock"); });
  const transaction = t.mock.fn(async () => { throw new Error("Must not create orders"); });
  Object.assign(prisma, { product: { findMany: products }, $transaction: transaction });
  t.after(() => Object.assign(prisma, { product: original.product, $transaction: original.transaction }));
  for (const paymentMethod of ["razorpay", "manual", "cod", "gift_card"]) {
    const response = await POST(new Request("https://store.example/api/payments/checkout", {
      method: "POST",
      headers: { origin: "https://store.example", cookie: `${AUTH_COOKIE}=unit`, "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentMethod,
        cart: [{ productId: "p1", sku: "SKU", quantity: 1 }],
        shippingAddress: { fullName: "Buyer", email: "buyer@example.test", phone: "9999999999", addressLine1: "Test road", city: "Kochi", state: "Kerala", pincode: "682001", country: "India" }
      })
    }));
    assert.equal(response.status, 400, paymentMethod);
    assert.match((await response.json()).message, /reference missing/i);
  }
  assert.equal(products.mock.callCount(), 0);
  assert.equal(transaction.mock.callCount(), 0);
});
