import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Prisma } from "@prisma/client";
import { updateSupplierCatalog } from "../lib/supplier-catalog";
import { updateSupplierProfile } from "../lib/supplier-profile";
import { POST } from "../app/api/supplier/actions/route";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";

test("supplier stock adopts opening stock and updates canonical cost and HSN without changing selling price", async () => {
  let inventoryData: Record<string, unknown> = {}, productData: Record<string, unknown> = {}, feedData: Record<string, unknown> = {};
  const tx = {
    product: { findFirst: async ({ where }: { where: unknown }) => { assert.deepEqual(where, { id: "p1", supplierId: "s1" }); return { id: "p1", sku: "SKU" }; }, update: async ({ data }: { data: typeof productData }) => { productData = data; } },
    inventory: { findMany: async ({ where }: { where: { warehouseId: null } }) => { assert.equal(where.warehouseId, null); return [{ id: "opening", supplierId: null, availableQty: 10, reservedQty: 2, damagedQty: 0, incomingQty: 0, status: "AVAILABLE" }]; }, update: async ({ where, data }: { where: { id: string }; data: typeof inventoryData }) => { assert.equal(where.id, "opening"); inventoryData = data; } },
    supplierProduct: { upsert: async ({ update }: { update: typeof feedData }) => { feedData = update; } },
  } as unknown as Prisma.TransactionClient;
  await updateSupplierCatalog(tx, "s1", { productId: "p1", stock: 8, costPrice: 45.75, hsnCode: "00123456" });
  assert.equal(inventoryData.availableQty, 8); assert.equal(inventoryData.supplierId, "s1");
  assert.equal(Object.hasOwn(inventoryData, "reservedQty"), false);
  assert.deepEqual(productData, { costPrice: 45.75, hsnCode: "00123456" });
  assert.equal(feedData.purchasePrice, 45.75);
});

test("stock updates reject foreign products, insufficient reserved stock and ambiguous duplicate rows before writes", async () => {
  let found = false, writes = 0;
  let rows = [{ id: "r1", supplierId: "s1", availableQty: 10, reservedQty: 5, damagedQty: 0, incomingQty: 0, status: "AVAILABLE" }];
  const tx = { product: { findFirst: async () => found ? { id: "p1", sku: "SKU" } : null, update: async () => { writes++; } }, inventory: { findMany: async () => rows, update: async () => { writes++; }, create: async () => { writes++; } } } as unknown as Prisma.TransactionClient;
  const input = { productId: "p1", stock: 3, costPrice: 30 };
  await assert.rejects(updateSupplierCatalog(tx, "s1", input), /Product not found/);
  found = true; await assert.rejects(updateSupplierCatalog(tx, "s1", input), /reserved quantity/);
  rows = [...rows, { ...rows[0], id: "duplicate" }];
  await assert.rejects(updateSupplierCatalog(tx, "s1", { ...input, stock: 10 }), /admin review/);
  assert.equal(writes, 0);
});

test("zero stock and clearing HSN are allowed while omitted HSN remains unchanged", async () => {
  let data: Record<string, unknown> = {}, created = 0;
  const tx = { product: { findFirst: async () => ({ id: "p1", sku: "SKU" }), update: async (args: { data: typeof data }) => { data = args.data; } }, inventory: { findMany: async () => [], create: async () => { created++; } }, supplierProduct: { upsert: async () => ({}) } } as unknown as Prisma.TransactionClient;
  await updateSupplierCatalog(tx, "s1", { productId: "p1", stock: 0, costPrice: 0, hsnCode: null });
  assert.deepEqual(data, { costPrice: 0, hsnCode: null });
  await updateSupplierCatalog(tx, "s1", { productId: "p1", stock: 0, costPrice: 0 });
  assert.deepEqual(data, { costPrice: 0 }); assert.equal(created, 2);
});

test("company profile partial updates preserve pickup, contact and GST fields; pickup moves clear their mapping", async () => {
  let saved: Record<string, unknown> = {};
  const current = { id: "s1", contactName: "Owner", phone: "9999999999", pickupAddress: "Old pickup", pickupAddressLine1: "Old pickup", shiprocketPickupLocation: "PICKUP_1", gstRegistered: true, companyAddress: "Company office" };
  const tx = { supplier: { findUnique: async () => current, update: async ({ data }: { data: typeof saved }) => { saved = data; } } } as unknown as Prisma.TransactionClient;
  await updateSupplierProfile(tx, "s1", { action: "PROFILE", companyPhone: "9888888888", companyRegistrationNumber: "REG1" });
  assert.deepEqual({ ...saved }, { companyPhone: "9888888888", companyRegistrationNumber: "REG1" });
  await updateSupplierProfile(tx, "s1", { pickupAddressLine1: "New pickup", pickupCity: "Kochi" });
  assert.equal(saved.pickupAddress, "New pickup, Kochi"); assert.equal(saved.shiprocketPickupLocation, null);
  assert.equal(Object.hasOwn(saved, "companyAddress"), false);
});

function supplier(t: TestContext) {
  t.mock.method(authContext, "current", async () => ({ id: "user", role: "SUPPLIER", fullName: "Supplier", email: "supplier@example.test", isActive: true }));
  const original = prisma.supplierContact;
  Object.assign(prisma, { supplierContact: { findFirst: async () => ({ supplier: { id: "s1" } }) } });
  t.after(() => Object.assign(prisma, { supplierContact: original }));
}
const request = (body: unknown) => new Request("https://store.example/api/supplier/actions", { method: "POST", headers: { origin: "https://store.example", "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("supplier API validates HSN, whole stock and money precision before opening a transaction", async t => {
  supplier(t);
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async () => { throw Error("Must not start a transaction"); } });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  const body = { action: "STOCK", productId: "p1", stock: 5, costPrice: 25, hsnCode: "001234" };
  for (const patch of [{ hsnCode: "ABC123" }, { stock: 1.5 }, { stock: -1 }, { costPrice: 25.555 }]) assert.equal((await POST(request({ ...body, ...patch }))).status, 400);
});

test("supplier-created products include HSN, stock and supplier price and remain drafts", async t => {
  supplier(t);
  const original = prisma.$transaction;
  let saved: Record<string, unknown> = {};
  const tx = { product: { create: async ({ data }: { data: typeof saved }) => { saved = data; } }, auditLog: { create: async () => ({}) } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal((await POST(request({ action: "PRODUCT", name: "New product", sku: "SKU", description: "Description", stock: 12, costPrice: 25.75, hsnCode: "001234" }))).status, 200);
  assert.equal(saved.status, "DRAFT"); assert.equal(saved.hsnCode, "001234"); assert.equal(saved.costPrice, 25.75);
  assert.deepEqual(saved.inventory, { create: { supplierId: "s1", availableQty: 12 } });
  assert.deepEqual(saved.supplierProducts, { create: { supplierId: "s1", supplierProductCode: "SKU", purchasePrice: 25.75 } });
});
