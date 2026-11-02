import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { integrationStore } from "../lib/integration-settings";
import { encryptCredentials, decryptCredentials } from "../lib/integration-crypto";
import { shiprocketPickupLocations, trackShiprocket } from "../lib/shiprocket";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { POST as save } from "../app/api/admin/integrations/route";
import { POST as check } from "../app/api/admin/integrations/shiprocket/route";

function setup(t: TestContext) {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  t.after(() => { if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous; });
  const encryptedCredentials = encryptCredentials({ email: "api@example.test", password: "test-private-password" });
  t.mock.method(integrationStore, "find", async () => ({ encryptedCredentials }));
}
const request = (body?: unknown, origin = "https://store.example") => new Request("https://store.example/api/admin/integrations", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

test("Shiprocket accounts without pickup addresses return an empty location list", async t => {
  setup(t);
  t.mock.method(globalThis, "fetch", async (url: string) => url.endsWith("/auth/login") ? Response.json({ token: "private-token" }) : Response.json({ data: { shipping_address: null, recent_addresses: [] } }));
  assert.deepEqual(await shiprocketPickupLocations(), []);
});

test("Shiprocket authenticates server-side and normalizes AWB scans with Indian local dates", async t => {
  setup(t);
  const calls: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, options: RequestInit) => {
    calls.push(url);
    assert.equal(options.redirect, "error"); assert.equal(options.cache, "no-store");
    if (url.endsWith("/auth/login")) { assert.deepEqual(JSON.parse(String(options.body)), { email: "api@example.test", password: "test-private-password" }); return Response.json({ token: "private-token" }); }
    assert.equal(new Headers(options.headers).get("Authorization"), "Bearer private-token");
    return Response.json({ tracking_data: { shipment_track: [{ current_status: "In Transit" }], shipment_track_activities: [{ date: "2026-11-02 10:00:00", status: "PICKED", activity: "Picked up", location: "Delhi" }, { date: "invalid" }] } });
  });
  const result = await trackShiprocket("AWB-12345");
  assert.equal(calls[1], "https://apiv2.shiprocket.in/v1/external/courier/track/awb/AWB-12345");
  assert.equal(result.status, "In Transit"); assert.equal(result.scans.length, 1);
  assert.equal(result.scans[0].date.toISOString(), "2026-11-02T04:30:00.000Z");
  assert.equal(JSON.stringify(result).includes("private-token"), false);
});

test("Shiprocket handles missing configuration, invalid AWB, rejected credentials and network errors safely", async t => {
  setup(t);
  await assert.rejects(trackShiprocket("../bad"), /Invalid AWB/);
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json({ message: "private provider error" }, { status: 401 }));
  await assert.rejects(trackShiprocket("AWB12345"), /rejected the credentials/);
  fetchMock.mock.mockImplementation(async () => { throw Error("private-token"); });
  await assert.rejects(trackShiprocket("AWB12345"), /could not be reached/);
  t.mock.method(integrationStore, "find", async () => null);
  await assert.rejects(shiprocketPickupLocations(), /Add your Shiprocket/);
});

test("pickup connection checks return only pickup names and are restricted to administrators", async t => {
  setup(t);
  t.mock.method(globalThis, "fetch", async (url: string) => url.endsWith("/auth/login") ? Response.json({ token: "private-token" }) : Response.json({ data: { shipping_address: [{ pickup_location: "Warehouse", phone: "private-phone", address: "private-address" }] } }));
  const auth = t.mock.method(authContext, "current", async () => ({ id: "admin", role: "ADMIN", fullName: "Admin", email: "admin@example.test", isActive: true }));
  const response = await check(request()); assert.equal(response.status, 200);
  const body = await response.json(); assert.deepEqual(body.locations, [{ name: "Warehouse" }]);
  assert.equal(JSON.stringify(body).includes("private"), false);
  assert.equal((await check(request({}, "https://evil.example"))).status, 403);
  auth.mock.mockImplementation(async () => null);
  assert.equal((await check(request())).status, 403);
});

test("Shiprocket settings encrypt secrets and preserve saved values when fields are blank", async t => {
  setup(t);
  t.mock.method(authContext, "current", async () => ({ id: "admin", role: "ADMIN", fullName: "Admin", email: "admin@example.test", isActive: true }));
  const original = prisma.integrationSetting, audit = prisma.auditLog, transaction = prisma.$transaction;
  let stored = "";
  Object.assign(prisma, { integrationSetting: { findUnique: async () => null, upsert: async (args: { create: { encryptedCredentials: string } }) => { stored = args.create.encryptedCredentials; return {}; } }, auditLog: { create: async () => ({}) }, $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops) });
  t.after(() => Object.assign(prisma, { integrationSetting: original, auditLog: audit, $transaction: transaction }));
  const response = await save(request({ provider: "SHIPROCKET", credentials: { email: "api@example.test", password: " space-sensitive-password ", pickupLocation: "Warehouse" } }));
  assert.equal(response.status, 200);
  assert.equal(stored.includes("space-sensitive-password"), false);
  assert.equal(decryptCredentials(stored).password, " space-sensitive-password ");
  Object.assign(prisma.integrationSetting, { findUnique: async () => ({ encryptedCredentials: stored }) });
  assert.equal((await save(request({ provider: "SHIPROCKET", credentials: { email: "", password: "", pickupLocation: "" } }))).status, 200);
  assert.equal(decryptCredentials(stored).email, "api@example.test");
});
