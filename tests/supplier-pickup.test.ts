import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Prisma } from "@prisma/client";
import { shipmentPickupLocation } from "../lib/supplier-pickup";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";
import { integrationStore } from "../lib/integration-settings";
import { encryptCredentials } from "../lib/integration-crypto";
import { PATCH } from "../app/api/admin/suppliers/[id]/pickup-location/route";
import { GET } from "../app/api/admin/shipping/pickup-locations/route";
import { POST as recordShipment } from "../app/api/admin/shipments/route";

const request = (body: unknown, origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/s1/pickup-location", { method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body) });
const context = { params: Promise.resolve({ id: "s1" }) };
function auth(t: TestContext) {
  return t.mock.method(authContext, "current", async () => ({ id: "admin", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
}
function provider(t: TestContext) {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  t.after(() => { if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous; });
  t.mock.method(integrationStore, "find", async () => ({ encryptedCredentials: encryptCredentials({ email: "api@example.test", password: "unit-only-password" }) }));
  t.mock.method(globalThis, "fetch", async (url: string) => url.endsWith("/auth/login") ? Response.json({ token: "unit-token" }) : Response.json({ data: { shipping_address: [{ pickup_location: "SUPPLIER_001" }] } }));
}

test("Shiprocket AWBs require an active supplier with a pickup mapping", async () => {
  let mapping: string | null = "SUPPLIER_001", status = "ACTIVE";
  const tx = { supplier: { findUnique: async () => ({ status, shiprocketPickupLocation: mapping }) } } as unknown as Prisma.TransactionClient;
  assert.equal(await shipmentPickupLocation(tx, null, "Delhivery"), null);
  await assert.rejects(shipmentPickupLocation(tx, null, "Shiprocket"), /Select the supplier/);
  assert.equal(await shipmentPickupLocation(tx, "s1", "Shiprocket"), "SUPPLIER_001");
  mapping = null; await assert.rejects(shipmentPickupLocation(tx, "s1", "Shiprocket"), /link this supplier/);
  status = "INACTIVE"; await assert.rejects(shipmentPickupLocation(tx, "s1", "Shiprocket"), /Active supplier/);
});

test("mapping and pickup-list endpoints block customers and reject cross-origin writes", async t => {
  const actor = auth(t);
  assert.equal((await PATCH(request({ pickupLocation: null }, "https://evil.example"), context)).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await PATCH(request({ pickupLocation: null }), context)).status, 403);
  assert.equal((await GET()).status, 403);
});

test("mapping rejects unknown locations and saves verified names with an audit without altering old shipments", async t => {
  auth(t); provider(t);
  const original = prisma.$transaction;
  let mapping: string | null = null, audits = 0;
  const tx = { supplier: { findUnique: async () => ({ id: "s1" }), update: async ({ data }: { data: { shiprocketPickupLocation: string | null } }) => { mapping = data.shiprocketPickupLocation; } }, auditLog: { create: async () => { audits++; } } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal((await PATCH(request({ pickupLocation: "UNREGISTERED" }), context)).status, 400);
  assert.equal(audits, 0);
  assert.equal((await PATCH(request({ pickupLocation: "SUPPLIER_001" }), context)).status, 200);
  assert.equal(mapping, "SUPPLIER_001"); assert.equal(audits, 1);
  assert.equal((await PATCH(request({ pickupLocation: null }), context)).status, 200);
  assert.equal(mapping, null); assert.equal(audits, 2);
});

test("admin AWB recording snapshots the supplier mapping and rejects unrelated suppliers", async t => {
  auth(t);
  const original = prisma.$transaction;
  const shipments: { supplierId: string; pickupLocation: string; trackingNumber: string }[] = [];
  const tx = {
    supplier: { findUnique: async () => ({ status: "ACTIVE", shiprocketPickupLocation: "SUPPLIER_001" }) },
    customerOrder: { findUnique: async () => ({ id: "o1", status: "CONFIRMED", orderItems: [{ supplierId: "s1" }] }), update: async () => ({}) },
    paymentTransaction: { findFirst: async () => ({ paymentStatus: "PAID" }) },
    shipment: { findFirst: async () => null, create: async ({ data }: { data: typeof shipments[number] }) => { shipments.push(data); } },
    orderItem: { updateMany: async () => ({}), count: async () => 0 }, auditLog: { create: async () => ({}) },
  };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  const body = { orderId: "o1", supplierId: "s1", courierName: "Shiprocket", awb: "AWB123456", shipmentCost: 80, pickupLocation: "FORGED_LOCATION" };
  assert.equal((await recordShipment(request(body))).status, 200);
  assert.equal(shipments[0].pickupLocation, "SUPPLIER_001");
  assert.equal(shipments[0].trackingNumber, "AWB123456");
  assert.equal((await recordShipment(request({ ...body, supplierId: "other-supplier" }))).status, 400);
  assert.equal(shipments.length, 1);
});
