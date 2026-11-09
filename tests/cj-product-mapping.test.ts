import assert from "node:assert/strict";
import test from "node:test";
import { authContext } from "../lib/auth";
import { cjProductMappingSchema } from "../lib/cj-product-mapping";
import { POST } from "../app/api/admin/suppliers/cj-mappings/route";

const mapping = { productId: "product", supplierId: "supplier", externalProductId: "cj-product", supplierVariantId: "cj-variant", supplierSku: "SKU" };
test("CJ product mappings require distinct product and variant identifiers", () => {
  assert.equal(cjProductMappingSchema.safeParse(mapping).success, true);
  assert.equal(cjProductMappingSchema.safeParse({ ...mapping, supplierVariantId: " " }).success, false);
  assert.equal(cjProductMappingSchema.safeParse({ ...mapping, externalProductId: "" }).success, false);
});
test("CJ mapping changes require management access and same-origin requests", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = (origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/cj-mappings", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(mapping) });
  assert.equal((await POST(request())).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
  assert.equal((await POST(request("https://other.example"))).status, 403);
});
