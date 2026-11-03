import assert from "node:assert/strict";
import test from "node:test";
import { singleItemTotal } from "../lib/customer-price";
import { priceCheckout } from "../lib/checkout";

test("product totals match server checkout including tax, handling, delivery and paise rounding", () => {
  for (const sellingPrice of [0.01, 19.99, 100, 1999.95]) {
    for (const gstRate of [null, 0, 5, 18, 28]) {
      const product = { id: "p", sku: "SKU", status: "ACTIVE", sellingPrice, gstRate, handlingCharge: 2.55, inventory: [{ availableQty: 10, reservedQty: 0 }] };
      const quote = priceCheckout([{ productId: "p", sku: "SKU", quantity: 1 }], [product]);
      assert.equal(singleItemTotal(product), quote.total);
    }
  }
});

test("a combined cart adds delivery once rather than once per product or unit", () => {
  const product = { id: "p", sku: "SKU", status: "ACTIVE", sellingPrice: 100, gstRate: 18, handlingCharge: 2, inventory: [{ availableQty: 10, reservedQty: 0 }] };
  assert.equal(singleItemTotal(product), 240);
  assert.equal(priceCheckout([{ productId: "p", sku: "SKU", quantity: 2 }], [product]).total, 360);
  assert.equal(singleItemTotal({ sellingPrice: null }), 0);
});
