import assert from "node:assert/strict";
import test from "node:test";
import { priceCheckout } from "../lib/checkout";
import { normalizeCart } from "../lib/cart";
import { publicProductDetails } from "../lib/public-product";

test("checkout requires configured product options and rejects altered values", () => {
  const product = { id: "p", sku: "SKU", status: "ACTIVE", sellingPrice: 100, color: "Olive, Peach", size: "66 cm, 80 cm", inventory: [{ availableQty: 5, reservedQty: 0 }] };
  assert.equal(priceCheckout([{ productId: "p", sku: "SKU", quantity: 1, selectedColor: "Olive", selectedSize: "66 cm" }], [product]).subtotal, 100);
  assert.throws(() => priceCheckout([{ productId: "p", sku: "SKU", quantity: 1 }], [product]), /options/);
  assert.throws(() => priceCheckout([{ productId: "p", sku: "SKU", quantity: 1, selectedColor: "Blue", selectedSize: "66 cm" }], [product]), /options/);
});

test("cart preserves choices without merging different variants", () => {
  const item = { id: "p", name: "Pajamas", sku: "SKU", sellingPrice: 100, quantity: 1, selectedColor: "Olive", selectedSize: "66 cm" };
  assert.equal(normalizeCart([item, { ...item, selectedColor: "Peach" }])[0].selectedColor, "Olive");
  assert.equal(normalizeCart([item, item])[0].quantity, 2);
});

test("public colour-photo assignments only expose photos belonging to the product", () => {
  const data = publicProductDetails({ id: "p", name: "P", sku: "S", brand: null, description: null, specifications: null, manufacturerInfo: null, warranty: null, trend: null, inTheBox: null, category: null, categoryId: null, imageUrls: ["https://example.test/a"], color: "Olive", colorImages: { Olive: "https://example.test/a", Peach: "https://example.test/secret" }, size: null, deliveryCharge: 0, sellingPrice: 10, gstRate: 0, handlingCharge: 0, returnDays: 0, isReturnable: false });
  assert.deepEqual(data.colorImages, { Olive: "https://example.test/a" });
});
