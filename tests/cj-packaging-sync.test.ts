import test from "node:test";
import assert from "node:assert/strict";
import { planCjPackagingSync } from "../lib/cj-packaging-sync";
import { authContext } from "../lib/auth";
import { POST } from "../app/api/admin/suppliers/cj-packaging-sync/route";

test("imports only an unambiguous packaging SKU from the matching shop and variant", () => {
  const mapping = { id: "m", externalProductId: "p", supplierVariantId: "v", packagingSku: null };
  const row = { shopId: "shop", pid: "p", vid: "v", packSku: "PACK-1" };
  assert.deepEqual(planCjPackagingSync([mapping], [row], "shop").updates, [{ id: "m", sku: "PACK-1", previous: null, productId: "p", variantId: "v" }]);
  assert.equal(planCjPackagingSync([mapping], [{ ...row, shopId: "other" }], "shop").updates.length, 0);
  assert.equal(planCjPackagingSync([mapping], [row, { ...row, packSku: "PACK-2" }], "shop").conflicts, 1);
  assert.equal(planCjPackagingSync([{ ...mapping, packagingSku: "MANUAL" }], [row], "shop").conflicts, 1);
});

test("packaging sync blocks unauthenticated, customer and cross-origin requests", async t => {
  const current = t.mock.method(authContext, "current", async () => null);
  const request = (origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/cj-packaging-sync", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ productId: "p" }) });
  assert.equal((await POST(request())).status, 401);
  current.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
  current.mock.mockImplementation(async () => ({ id: "a", email: "a@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  assert.equal((await POST(request("https://other.example"))).status, 403);
});
