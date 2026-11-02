import assert from "node:assert/strict";
import test from "node:test";
import type { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";
import { deleteUnusedProduct } from "../lib/product-deletion";
import { DELETE } from "../app/api/products/[id]/route";

test("only management can delete products and cross-origin requests are rejected", async t => {
  const original = authContext.current;
  let role: UserRole | null = null;
  authContext.current = async () => role ? { id: "actor", role, email: "actor@example.test", fullName: "Actor", isActive: true } : null;
  t.after(() => { authContext.current = original; });
  const context = { params: Promise.resolve({ id: "p" }) };
  const request = (origin = "https://shop.example") => new Request("https://shop.example/api/products/p", { method: "DELETE", headers: { origin } });
  assert.equal((await DELETE(request("https://other.example"), context)).status, 403);
  assert.equal((await DELETE(request(), context)).status, 401);
  for (role of ["CUSTOMER", "SUPPLIER", "STAFF"] as const) assert.equal((await DELETE(request(), context)).status, 403);
});
test("product deletion preserves order, purchase, finance and reserved-stock records", async t => {
  const original = prisma.$transaction;
  let missing = false, orders = 0, purchases = 0, costs = 0, reservations = 0, deletes = 0, audits = 0;
  const tx = { product: { findUnique: async () => missing ? null : { id: "p", name: "Product", sku: "SKU" }, delete: async () => { deletes++; return {}; } }, orderItem: { count: async () => orders }, purchaseOrderItem: { count: async () => purchases }, productCost: { count: async () => costs }, inventory: { count: async () => reservations }, auditLog: { create: async () => { audits++; return {}; } } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "Serializable"); return work(tx); } });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  missing = true; await assert.rejects(deleteUnusedProduct("p", "actor"), /not found/); missing = false;
  orders = 1; await assert.rejects(deleteUnusedProduct("p", "actor"), /history/); orders = 0;
  purchases = 1; await assert.rejects(deleteUnusedProduct("p", "actor"), /history/); purchases = 0;
  costs = 1; await assert.rejects(deleteUnusedProduct("p", "actor"), /history/); costs = 0;
  reservations = 1; await assert.rejects(deleteUnusedProduct("p", "actor"), /reserved/); reservations = 0;
  assert.equal(deletes, 0); assert.equal(audits, 0);
  assert.equal(await deleteUnusedProduct("p", "actor"), "p");
  assert.equal(deletes, 1); assert.equal(audits, 1);
});
