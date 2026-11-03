import assert from "node:assert/strict";
import test from "node:test";
import { publicProductDetails } from "../lib/public-product";

test("product browser data excludes supplier IDs, costs and internal fields and normalizes decimals", () => {
  const product = {
    id: "public-id", name: "Product", sku: "SKU", brand: null, description: null,
    specifications: null, manufacturerInfo: null, warranty: null, trend: null, inTheBox: null,
    category: null, categoryId: null, imageUrls: [], size: null, deliveryCharge: null,
    sellingPrice: { toString: () => "123.45" }, gstRate: { toString: () => "5" },
    handlingCharge: { toString: () => "2.50" }, returnDays: 7, isReturnable: true,
    supplierId: "PRIVATE-SUPPLIER", costPrice: 47.39, internalNote: "PRIVATE-NOTE",
  };
  const visible = publicProductDetails(product);
  assert.equal(visible.sellingPrice, 123.45); assert.equal(visible.gstRate, 5);
  assert.equal(visible.handlingCharge, 2.5); assert.equal(visible.deliveryCharge, null);
  const json = JSON.stringify(visible);
  for (const privateValue of ["supplierId", "costPrice", "47.39", "PRIVATE-SUPPLIER", "PRIVATE-NOTE"]) assert.equal(json.includes(privateValue), false);
  assert.equal(visible.sku, "SKU"); assert.equal(visible.returnDays, 7);
});
