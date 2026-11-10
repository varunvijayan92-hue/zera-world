import test from "node:test";
import assert from "node:assert/strict";
import { parseCjSyncVariants, planCjVariantSync } from "../lib/cj-variant-sync";
import { authContext } from "../lib/auth";
import { POST } from "../app/api/admin/suppliers/cj-variant-sync/route";

test("CJ variant sync rejects incomplete, mismatched or duplicate supplier data", () => {
  const one = { vid: "vid1", pid: "pid1", variantSku: "sku1", variantNameEn: "Olive 66cm" };
  assert.deepEqual(parseCjSyncVariants("pid1", { pid: "pid1", variants: [one] }), [one]);
  assert.throws(() => parseCjSyncVariants("pid1", { pid: "pid1", variants: [] }));
  assert.throws(() => parseCjSyncVariants("pid1", { pid: "pid1", variants: [one, one] }));
  assert.throws(() => parseCjSyncVariants("pid1", { pid: "pid1", variants: [{ ...one, pid: "other" }] }));
  assert.throws(() => parseCjSyncVariants("pid1", { pid: "other", variants: [one] }));
});

test("sync plans preserve existing mappings and refuse conflicting SKUs", () => {
  const incoming = parseCjSyncVariants("p", { pid: "p", variants: [{ vid: "cj1", pid: "p", variantSku: "SKU", variantNameEn: "Olive 66cm" }] });
  const base = { productId: "store", supplierId: "supplier", cjProductId: "p", incoming, variants: [], mappings: [], newId: () => "local" };
  const plan = planCjVariantSync(base);
  assert.equal(plan.newVariants[0].sku, "SKU");
  assert.equal(plan.newMappings[0].mappingStatus, "ACTIVE");
  assert.equal(plan.newMappings[0].supplierAvailability, "UNKNOWN");
  assert.throws(() => planCjVariantSync({ ...base, variants: [{ id: "other", productId: "another-product", sku: "SKU", variantName: "x" }] }));
  const existing = { id: "local", productId: "store", sku: "SKU", variantName: "Olive 66cm" };
  const mapping = { id: "mapping", variantId: "local", externalProductId: "p", supplierVariantId: "cj1", supplierSku: "SKU", mappingStatus: "PENDING" };
  assert.equal(planCjVariantSync({ ...base, variants: [existing], mappings: [mapping] }).newMappings.length, 0);
  assert.deepEqual(planCjVariantSync({ ...base, variants: [existing], mappings: [mapping] }).activateMappingIds, ["mapping"]);
  assert.throws(() => planCjVariantSync({ ...base, variants: [existing], mappings: [{ ...mapping, supplierSku: "WRONG" }] }));
});

test("variant sync rejects visitors, customers and cross-origin writes before contacting CJ", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = (origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/cj-variant-sync", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ productId: "store", cjProductId: "cj1" }) });
  assert.equal((await POST(request())).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "customer", email: "customer@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
  assert.equal((await POST(request("https://other.example"))).status, 403);
});
