import assert from "node:assert/strict";
import test from "node:test";
import { productSchema } from "../lib/validators";
import { resolveProductCategory } from "../lib/catalog";
import { priceCheckout } from "../lib/checkout";

test("optional product associations and charges can be explicitly cleared", async () => {
  const result = productSchema.partial().parse({ categoryId: "", supplierId: "", gstRate: 0, handlingCharge: 0, returnDays: 0, description: "", brand: "" });
  assert.equal(result.supplierId, null);
  assert.equal(result.gstRate, 0);
  assert.equal(result.handlingCharge, 0);
  assert.deepEqual(await resolveProductCategory(result.categoryId), { categoryId: null, category: null });
});
test("cleared GST and handling do not add charges to checkout", () => {
  const quote = priceCheckout([{ productId: "p", sku: "sku", quantity: 2 }], [{ id: "p", sku: "sku", status: "ACTIVE", sellingPrice: 100, gstRate: 0, handlingCharge: 0, inventory: [{ availableQty: 5, reservedQty: 0 }] }]);
  assert.equal(quote.taxes, 0);
  assert.equal(quote.handlingCharges, 0);
  assert.equal(quote.total, 200);
});

test("empty optional product detail fields can be cleared with null", () => {
 const parsed = productSchema.parse({ name: "Product", sku: "SKU", specifications: null, manufacturerInfo: null });
 assert.equal(parsed.specifications, null);
 assert.equal(parsed.manufacturerInfo, null);
});
