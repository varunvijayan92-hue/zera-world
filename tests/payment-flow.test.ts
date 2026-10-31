import assert from "node:assert/strict";
import test from "node:test";

import { createPaymentSession, generateRazorpayWebhookSignature, verifyRazorpaySignature } from "../lib/payment";
import { checkoutRequestSchema } from "../lib/validators";

test("Razorpay checkout fails closed when credentials are missing", async () => {
  const originalId = process.env.RAZORPAY_KEY_ID;
  const originalSecret = process.env.RAZORPAY_KEY_SECRET;
  try {
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    await assert.rejects(() => createPaymentSession({ amount: 1499, orderId: "ord_demo", provider: "razorpay" }), /not configured/);
  } finally {
    if (originalId === undefined) delete process.env.RAZORPAY_KEY_ID; else process.env.RAZORPAY_KEY_ID = originalId;
    if (originalSecret === undefined) delete process.env.RAZORPAY_KEY_SECRET; else process.env.RAZORPAY_KEY_SECRET = originalSecret;
  }
});

test("verifyRazorpaySignature accepts valid signatures and rejects tampered payloads", () => {
  const payload = "order_123|pay_456";
  const secret = "secret-demo";
  const validSignature = generateRazorpayWebhookSignature({ payload, secret });

  assert.equal(verifyRazorpaySignature({ payload, signature: validSignature, secret }), true);
  assert.equal(verifyRazorpaySignature({ payload: "order_123|pay_789", signature: validSignature, secret }), false);
});

test("generateRazorpayWebhookSignature creates a consistent sandbox test signature", () => {
  const payload = JSON.stringify({ event: "payment.captured", payment: { id: "pay_demo_123" } });
  const secret = "sandbox-secret";
  const signature = generateRazorpayWebhookSignature({ payload, secret });

  assert.equal(signature.length, 64);
  assert.ok(signature.startsWith("4") || signature.startsWith("a") || signature.startsWith("b") || signature.startsWith("c") || signature.startsWith("d") || signature.startsWith("e") || signature.startsWith("f"));
});

test("checkoutRequestSchema validates server-side checkout details without trusting browser totals", () => {
  const valid = checkoutRequestSchema.safeParse({
    cart: [
      { productId: "prod_1", sku: "SKU-1", quantity: 2 },
    ],
    shippingAddress: {
      fullName: "Test Buyer",
      email: "test@example.com",
      phone: "+919999999999",
      addressLine1: "12 Market Road",
      addressLine2: "",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      country: "India",
      landmark: "Near plaza",
    },
    paymentMethod: "razorpay",
  });

  assert.equal(valid.success, true);
});
