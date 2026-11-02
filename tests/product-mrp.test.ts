import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { productSchema } from "../lib/validators";
import { validateMrp, saveProductExtras } from "../lib/product-pricing";
import { showStruckMrp } from "../lib/product-pricing-display";
import { priceCheckout } from "../lib/checkout";

test("Product size is optional, trimmed, and stored for assorted dress sizing", () => {
  const fields = productSchema.partial().parse({ size: " S, M, L, XL " });
  assert.equal(fields.size, "S, M, L, XL");
  assert.equal(productSchema.partial().parse({ size: "" }).size, null);
});

test("MRP and HSN are optional, clearable, and preserve leading-zero HSN codes", () => {
  const fields = productSchema.partial().parse({ mrp: "150.50", hsnCode: "00123456" });
  assert.equal(fields.mrp, 150.5); assert.equal(fields.hsnCode, "00123456");
  assert.deepEqual(productSchema.partial().parse({ mrp: "", hsnCode: "" }), { mrp: null, hsnCode: null });
  for (const mrp of [-1, 0, Infinity, 100.001]) assert.equal(productSchema.partial().safeParse({ mrp }).success, false);
  assert.equal(productSchema.partial().safeParse({ hsnCode: "AB1234" }).success, false);
});
test("MRP cannot be below selling price and strike-through only represents a lower selling price", () => {
  assert.throws(() => validateMrp(99, 100), /at least/);
  assert.doesNotThrow(() => validateMrp(null, 100));
  assert.doesNotThrow(() => validateMrp(100, 100));
  assert.ok(showStruckMrp(100, 150));
  for (const mrp of [null, undefined, 0, 99, 100, NaN]) assert.equal(showStruckMrp(100, mrp), false);
});
test("partial product edits preserve or explicitly clear MRP and HSN and reject incompatible selling-price changes", async () => {
  const writes: unknown[][] = [];
  const tx = { $queryRaw: async () => [{ id: "p", mrp: 200, hsnCode: "00123456" }], $executeRaw: async (_: unknown, ...values: unknown[]) => { writes.push(values); return 1; } } as unknown as Prisma.TransactionClient;
  assert.deepEqual(await saveProductExtras(tx, "p", { hsnCode: "1234" }, 100), { mrp: 200, hsnCode: "1234" });
  assert.deepEqual(await saveProductExtras(tx, "p", { mrp: null, hsnCode: null }, 100), { mrp: null, hsnCode: null });
  const count = writes.length;
  await assert.rejects(saveProductExtras(tx, "p", {}, 250), /at least/);
  assert.equal(writes.length, count);
});
test("checkout charges the selling price, irrespective of MRP", () => {
  const product = { id: "p", sku: "sku", status: "ACTIVE", sellingPrice: 100, mrp: 500, gstRate: 0, handlingCharge: 0, inventory: [{ availableQty: 2, reservedQty: 0 }] };
  const quote = priceCheckout([{ productId: "p", sku: "sku", quantity: 1 }], [product]);
  assert.equal(quote.subtotal, 100); assert.equal(quote.total, 220);
});
