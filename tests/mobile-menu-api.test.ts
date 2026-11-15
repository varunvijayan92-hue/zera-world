import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { adminNavigation } from "../lib/admin-navigation";
import { supplierNavigation } from "../lib/supplier-navigation";
import { mobileMenuContract } from "../lib/mobile-menu-contract";
import { mobileEndpoints } from "../lib/mobile-endpoints";
import { mobileListQuery, mobileListMeta } from "../lib/mobile-list";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { GET as navigation } from "../app/api/mobile/navigation/route";
import { GET as adminSection } from "../app/api/mobile/admin/[section]/route";
import { GET as supplierDetail } from "../app/api/mobile/supplier/[section]/[id]/route";
import { GET as supplierSection } from "../app/api/mobile/supplier/[section]/route";

function mockModel(t: TestContext, name: string, methods: Record<string, unknown>) {
  const client = prisma as unknown as Record<string, unknown>;
  const original = client[name];
  Object.assign(prisma, { [name]: methods });
  t.after(() => Object.assign(prisma, { [name]: original }));
}

test("every menu advertises its read endpoint and all workflow aliases exist", () => {
  const adminSource = readFileSync("app/api/mobile/admin/[section]/route.ts", "utf8");
  const supplierSource = readFileSync("app/api/mobile/supplier/[section]/route.ts", "utf8");
  for (const group of adminNavigation) for (const item of group.items) {
    const id = item.href.slice("/admin/".length);
    assert.ok(adminSource.includes(`case "${id}"`), id);
    assert.equal(mobileMenuContract("ADMIN", id).read.path, `/api/mobile/admin/${id}`);
  }
  for (const [, entries] of supplierNavigation) for (const [, id] of entries) {
    assert.ok(supplierSource.includes(`case "${id}"`), id);
    assert.equal(mobileMenuContract("SUPPLIER", id).read.path, `/api/mobile/supplier/${id}`);
  }
  for (const endpoint of mobileEndpoints) {
    const file = `app${endpoint.path}/route.ts`;
    assert.ok(existsSync(file), file);
    const source = readFileSync(file, "utf8");
    for (const method of endpoint.methods) assert.match(source, new RegExp(`\\b${method}\\b`));
    assert.ok(!endpoint.path.includes("webhook"));
  }
});

test("pagination validates bounds and preserves list versus report envelopes", () => {
  assert.deepEqual(mobileListQuery(new Request("https://store.test/?page=3&limit=25")), { page: 3, limit: 25, skip: 50 });
  for (const query of ["page=0", "page=1.5", "limit=201", "limit=no", "page="]) assert.throws(() => mobileListQuery(new Request(`https://store.test/?${query}`)));
  assert.deepEqual(mobileListMeta([], 2, 25), { page: 2, limit: 25, hasMore: false });
  assert.deepEqual(mobileListMeta({ transactions: [], profitAndLoss: {} }, 1, 25), { page: 1, limit: 25, collections: { transactions: { hasMore: false } } });
});

test("navigation rejects anonymous and customer sessions and includes admin menu contracts", async t => {
  let role: string | null = null;
  t.mock.method(authContext, "current", async () => role ? { id: "actor", role, isActive: true } : null);
  assert.equal((await navigation()).status, 401);
  role = "CUSTOMER";
  assert.equal((await navigation()).status, 403);
  role = "ADMIN";
  const response = await navigation();
  const body = await response.json();
  assert.equal(body.groups.flatMap((group: any) => group.items).length, 22);
  assert.ok(body.groups[0].items[0].api.read.path);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("admin lists pass pagination to the database and contacts read website requests", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "admin", role: "ADMIN", isActive: true }));
  mockModel(t, "auditLog", { findMany: async (args: any) => {
    assert.deepEqual(args.where, { action: "CONTACT_REQUEST", entityType: "ContactMessage" });
    assert.equal(args.skip, 10); assert.equal(args.take, 10);
    return [];
  } });
  const response = await adminSection(new Request("https://store.test/api/mobile/admin/contact-messages?page=2&limit=10"), { params: Promise.resolve({ section: "contact-messages" }) });
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).meta, { page: 2, limit: 10, hasMore: false });
  assert.equal((await adminSection(new Request("https://store.test/?limit=0"), { params: Promise.resolve({ section: "orders" }) })).status, 400);
  assert.equal((await adminSection(new Request("https://store.test/", { headers: { origin: "https://evil.test" } }), { params: Promise.resolve({ section: "orders" }) })).status, 403);
});

test("seller channels return configuration status without credential values", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "admin", role: "MANAGER", isActive: true }));
  mockModel(t, "integrationSetting", { findMany: async (args: any) => {
    assert.deepEqual(args.select, { provider: true, updatedAt: true });
    return [{ provider: "AMAZON", updatedAt: new Date() }];
  } });
  const response = await adminSection(new Request("https://store.test/"), { params: Promise.resolve({ section: "sellers" }) });
  const body = await response.json();
  assert.equal(body.data[0].configured, true);
  assert.equal(body.data[1].configured, false);
  assert.equal(body.data[0].connectorEnabled, false);
  assert.equal(body.data[0].encryptedCredentials, undefined);
});

test("supplier record reads enforce ownership even for a supplied record ID", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "supplier-user", role: "SUPPLIER", isActive: true }));
  mockModel(t, "supplierContact", { findFirst: async () => ({ supplier: { id: "own-supplier" } }) });
  mockModel(t, "supplierLocalCustomer", { findFirst: async (args: any) => {
    assert.deepEqual(args.where, { id: "another-record", supplierId: "own-supplier" });
    return null;
  } });
  const response = await supplierDetail(new Request("https://store.test/"), { params: Promise.resolve({ section: "local-customers", id: "another-record" }) });
  assert.equal(response.status, 404);
});

test("every published admin and supplier menu executes its read handler", async t => {
  let role = "ADMIN";
  t.mock.method(authContext, "current", async () => ({ id: "actor", role, isActive: true }));
  for (const name of ["customerOrder", "product", "user", "supplier", "shipment", "returnRequest", "orderItem", "auditLog", "supportTicket", "inventory", "storeCategory", "syncJob", "paymentTransaction", "customerVoucher", "expense", "refund", "integrationSetting", "supplierSettlement", "supplierLocalCustomer"]) {
    mockModel(t, name, { findMany: async () => [], count: async () => 0, aggregate: async () => ({ _sum: { totalAmount: null } }) });
  }
  mockModel(t, "supplierContact", { findFirst: async () => ({ supplier: { id: "supplier" } }) });
  for (const group of adminNavigation) for (const item of group.items) {
    const section = item.href.slice("/admin/".length);
    const response = await adminSection(new Request(`https://store.test/api/mobile/admin/${section}`), { params: Promise.resolve({ section }) });
    assert.equal(response.status, 200, section);
  }
  role = "SUPPLIER";
  for (const [, entries] of supplierNavigation) for (const [, section] of entries) {
    const response = await supplierSection(new Request(`https://store.test/api/mobile/supplier/${section}`), { params: Promise.resolve({ section }) });
    assert.equal(response.status, 200, section);
  }
});
