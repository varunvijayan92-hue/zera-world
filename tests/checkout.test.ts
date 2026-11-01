import assert from "node:assert/strict";
import test from "node:test";
import { priceCheckout } from "../lib/checkout";
import { nextPaymentStatus, paymentMatches } from "../lib/payment-state";
import { checkoutRequestSchema } from "../lib/validators";

const cart = [{ productId: "p1", sku: "SKU", quantity: 2 }];
const product = { id: "p1", sku: "SKU", status: "ACTIVE", sellingPrice: 99.99,
  inventory: [{ availableQty: 5, reservedQty: 2 }] };

test("checkout calculates prices in paise from persisted products", () => {
  assert.deepEqual(priceCheckout(cart, [product]), {
    subtotal: 199.98, taxes: 10, handlingCharges: 0, shippingCharges: 120, total: 329.98, currency: "INR",
  });
});

test("checkout rejects inactive, missing, mismatched, unpriced and unavailable products", () => {
  for (const patch of [{ status: "DRAFT" }, { status: "ARCHIVED" }, { sku: "OTHER" },
    { sellingPrice: null }, { sellingPrice: -1 }, { sellingPrice: Infinity },
    { inventory: [] }, { inventory: [{ availableQty: 3, reservedQty: 2 }] }]) {
    assert.throws(() => priceCheckout(cart, [{ ...product, ...patch }]));
  }
  assert.throws(() => priceCheckout(cart, []));
  assert.throws(() => priceCheckout([...cart, ...cart], [product]));
  assert.throws(() => priceCheckout([{ ...cart[0], quantity: -1 }], [product]));
});

test("duplicate cart lines cannot bypass the per-product quantity limit", () => {
  const result = checkoutRequestSchema.shape.cart.safeParse([...cart, ...cart]);
  assert.equal(result.success, false);
});

test("damaged, reserved and in-transit inventory cannot be sold as available stock", () => {
  for (const status of ["DAMAGED", "RESERVED", "TRANSIT"]) {
    assert.throws(() => priceCheckout(cart, [{ ...product, inventory: [{ availableQty: 100, reservedQty: 0, status }] }]));
  }
  assert.equal(priceCheckout(cart, [{ ...product, inventory: [{ availableQty: 2, reservedQty: 0, status: "AVAILABLE" }, { availableQty: 100, reservedQty: 0, status: "DAMAGED" }] }]).subtotal, 199.98);
});

test("gateway amounts, currency and an already-bound payment ID must match", () => {
  const transaction = { amount: 329.98, currency: "INR", gatewayPaymentId: null };
  const payment = { id: "pay1", amount: 32998, currency: "INR" };
  assert.equal(paymentMatches(transaction, payment), true);
  assert.equal(paymentMatches(transaction, { ...payment, amount: 1 }), false);
  assert.equal(paymentMatches(transaction, { ...payment, currency: "USD" }), false);
  assert.equal(paymentMatches(transaction, { id: "pay1" }), false);
  assert.equal(paymentMatches({ ...transaction, gatewayPaymentId: "pay2" }, payment), false);
  assert.equal(paymentMatches({ ...transaction, gatewayPaymentId: "failed-attempt", paymentStatus: "FAILED" }, payment), true);
});

test("late and duplicate webhooks never downgrade captured or refunded payments", () => {
  assert.equal(nextPaymentStatus("PENDING", "payment.captured"), "PAID");
  assert.equal(nextPaymentStatus("FAILED", "payment.captured"), "PAID");
  assert.equal(nextPaymentStatus("AUTHORIZED", "payment.failed"), null);
  for (const status of ["PAID", "REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"]) {
    for (const event of ["payment.failed", "payment.authorized", "payment.captured"]) {
      assert.equal(nextPaymentStatus(status, event), null);
    }
  }
  assert.equal(nextPaymentStatus("PENDING", "unknown"), null);
});
