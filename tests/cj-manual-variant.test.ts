import test from "node:test";
import assert from "node:assert/strict";
import { authContext } from "../lib/auth";
import { POST } from "../app/api/admin/suppliers/cj-manual-variant/route";
import { prisma } from "../lib/prisma";

test("manual CJ mappings require management access, same origin and valid IDs", async t => {
  const current = t.mock.method(authContext, "current", async () => null);
  const request = (origin = "https://store.example", payload: unknown = {}) => new Request("https://store.example/api/admin/suppliers/cj-manual-variant", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal((await POST(request())).status, 401);
  current.mock.mockImplementation(async () => ({ id: "c", email: "customer@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
  current.mock.mockImplementation(async () => ({ id: "a", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  assert.equal((await POST(request("https://other.example"))).status, 403);
  assert.equal((await POST(request())).status, 400);
});

test("manual mapping stays pending and records the selected supplier variant", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "a", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  let saved: Record<string, unknown> = {};
  const tx = {
    product: { findUnique: async () => ({ supplierId: "supplier", supplier: { status: "ACTIVE", sourceType: "EXTERNAL_SITE", provider: "CJ_DROPSHIPPING" } }) },
    supplierProductMapping: { findFirst: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { saved = data; return { id: "mapping" }; } },
    productVariant: { findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => ({ ...data }) },
    auditLog: { create: async () => ({}) },
  };
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  const request = new Request("https://store.example/api/admin/suppliers/cj-manual-variant", { method: "POST", headers: { origin: "https://store.example", "Content-Type": "application/json" }, body: JSON.stringify({ productId: "p", cjProductId: "cj1", cjVariantId: "v1", cjSku: "CJ-SKU", variantName: "Olive 66 cm", optionKey: "Olive-66cm" }) });
  assert.equal((await POST(request)).status, 201);
  assert.equal(saved.mappingStatus, "PENDING");
  assert.equal(saved.supplierVariantId, "v1");
  assert.equal(saved.supplierVariantKey, "Olive-66cm");
});
