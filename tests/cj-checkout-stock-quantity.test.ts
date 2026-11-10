import test from "node:test";
import assert from "node:assert/strict";
import { priceCheckout } from "../lib/checkout";
const product = { id: "p", sku: "s", status: "ACTIVE", sellingPrice: 100, color: "Olive, Floral", size: "66 cm", inventory: [] };
const item = { productId: "p", sku: "s", quantity: 2, selectedColor: "Olive", selectedSize: "66 cm" };
test("uses the selected supplier variant quantity, not product stock", () => {
  assert.doesNotThrow(() => priceCheckout([item], [product], new Map([["p", 2]])));
  assert.throws(() => priceCheckout([item], [product], new Map([["p", 1]])), /Requested quantity/);
  assert.throws(() => priceCheckout([item], [product]), /Requested quantity/);
});
