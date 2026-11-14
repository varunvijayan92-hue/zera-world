import assert from "node:assert/strict";
import test from "node:test";
import { cjCatalogProducts, cjCatalogVariants, cjIntegrationStatus, cjOrderSyncStatus, cjProductSyncStatus } from "../lib/cj-catalog";
import { GET } from "../app/api/admin/suppliers/cj-catalog/route";
import { authContext } from "../lib/auth";

test("CJ catalogue results expose only the product and variant details needed for mapping", () => {
  assert.deepEqual(cjCatalogProducts({ content: [{ productList: [{ id: "p", nameEn: "Product", sku: "s", sellPrice: "5", supplierName: "private" }, { id: null }] }] }), [{ id: "p", name: "Product", sku: "s", price: "5" }]);
  assert.deepEqual(cjCatalogVariants({ variants: [{ vid: "v", variantNameEn: "Blue", variantSku: "s-blue", hidden: "private" }, {}] }), [{ id: "v", name: "Blue", sku: "s-blue" }]);
  assert.deepEqual(cjCatalogProducts(null), []); assert.deepEqual(cjCatalogVariants(null), []);
});
test("CJ catalogue blocks unauthorized users and invalid queries before calling CJ", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = (query = "?q=shirt") => new Request(`https://store.example/api/admin/suppliers/cj-catalog${query}`);
  assert.equal((await GET(request())).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await GET(request())).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "a", email: "a@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  assert.equal((await GET(request("?q=x"))).status, 400);
  assert.equal((await GET(request("?productId=..%2F.."))).status, 400);
});

test("CJ integration exposes a connected status with pending product and order syncs", () => {
  const status = cjIntegrationStatus();
  assert.equal(status.status, "CONNECTED");
  assert.match(status.message, /not yet implemented/i);
  assert.equal(cjProductSyncStatus().status, "PENDING");
  assert.equal(cjOrderSyncStatus().status, "PENDING");
  assert.equal(cjProductSyncStatus().available, false);
  assert.equal(cjOrderSyncStatus().available, false);
});
