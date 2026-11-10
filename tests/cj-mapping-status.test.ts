import test from "node:test";
import assert from "node:assert/strict";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { POST } from "../app/api/admin/suppliers/cj-mapping-status/route";

const request = (status: string, origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/cj-mapping-status", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ productId: "p", mappingId: "m", status }) });
test("mapping status is restricted to management and same-origin requests", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  assert.equal((await POST(request("DISABLED"))).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request("DISABLED"))).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "a", email: "a@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  assert.equal((await POST(request("DISABLED", "https://other.example"))).status, 403);
});
test("deactivation clears stale stock and pending mappings cannot be activated without sync", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "a", email: "a@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  const mapping = { id: "m", productId: "p", mappingStatus: "ACTIVE", externalProductId: "pid", supplierVariantId: "vid", supplierSku: "sku", variantId: "variant", supplierId: "supplier" };
  let saved: Record<string, unknown> = {};
  const original = { supplierProductMapping: prisma.supplierProductMapping, transaction: prisma.$transaction };
  const tx = { supplierProductMapping: { updateMany: async ({ data }: { data: Record<string, unknown> }) => { saved = data; return { count: 1 }; } }, auditLog: { create: async () => ({}) } };
  Object.assign(prisma, { supplierProductMapping: { findFirst: async () => mapping }, $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { supplierProductMapping: original.supplierProductMapping, $transaction: original.transaction }));
  assert.equal((await POST(request("DISABLED"))).status, 200);
  assert.equal(saved.mappingStatus, "DISABLED");
  assert.equal(saved.supplierStockQty, null);
  mapping.mappingStatus = "PENDING";
  assert.equal((await POST(request("ACTIVE"))).status, 409);
});
