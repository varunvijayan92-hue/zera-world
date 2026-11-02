import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prisma } from "../lib/prisma";
import { validDeliveryToken, recordDeliveryWebhook } from "../lib/delivery-webhook";
import { integrationStore } from "../lib/integration-settings";
import { encryptCredentials } from "../lib/integration-crypto";
import { authContext } from "../lib/auth";
import { POST } from "../app/api/webhooks/delivery/route";
import { GET } from "../app/api/admin/integrations/shiprocket/webhook/route";

const token = "unit-webhook-token-".padEnd(64, "x");
const payload = { awb: "AWB123456", current_status: "DELIVERED", current_timestamp: "2026-11-02 14:30:00", scans: [{ date: "2026-11-02 10:00:00", status: "PICKED", activity: "Collected", location: "Delhi" }] };

function setup(t: TestContext) {
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
  t.after(() => { if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous; });
  t.mock.method(integrationStore, "find", async () => ({ encryptedCredentials: encryptCredentials({ webhookToken: token, password: "private-api-password" }) }));
}

test("webhook token comparison rejects missing, short, wrong and oversized tokens", () => {
  assert.equal(validDeliveryToken(token, token), true);
  for (const value of [null, "", "wrong", "z".repeat(300)]) assert.equal(validDeliveryToken(value, token), false);
  assert.equal(validDeliveryToken("short", "short"), false);
  assert.equal(validDeliveryToken(token, undefined), false);
});

test("webhooks save scoped tracking events idempotently without confirming delivery or creating shipments", async t => {
  const original = prisma.$transaction;
  const saved: { shipmentId: string; eventType: string; eventTime: Date; description: string }[] = [];
  const tx = { shipment: { findMany: async (args: unknown) => { assert.deepEqual(args, { where: { trackingNumber: "AWB123456", courierName: { equals: "Shiprocket", mode: "insensitive" } }, select: { id: true } }); return [{ id: "shipment1" }]; } }, trackingEvent: { findFirst: async ({ where }: { where: typeof saved[number] }) => saved.find(event => event.shipmentId === where.shipmentId && event.eventType === where.eventType && +event.eventTime === +where.eventTime), create: async ({ data }: { data: typeof saved[number] }) => { saved.push(data); return data; } } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown, options: { isolationLevel: string }) => { assert.equal(options.isolationLevel, "Serializable"); return work(tx); } });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal(await recordDeliveryWebhook(payload), true);
  assert.equal(await recordDeliveryWebhook(payload), true);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].eventTime.toISOString(), "2026-11-02T04:30:00.000Z");
  assert.equal(saved[1].eventType, "DELIVERED");
});

test("webhook connection tests and unmatched AWBs are acknowledged without inventing shipments", async t => {
  const original = prisma.$transaction;
  const tx = { shipment: { findMany: async () => [] } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal(await recordDeliveryWebhook({}), true);
  assert.equal(await recordDeliveryWebhook(payload), true);
  assert.equal(await recordDeliveryWebhook({ awb: "../invalid" }), false);
  assert.equal(await recordDeliveryWebhook({ awb: "AWB123456", scans: [{ date: "invalid" }] }), true);
});

test("webhook route requires the token and bounds invalid and oversized requests", async t => {
  setup(t);
  const request = (body: string, key = token, length?: string) => new Request("https://store.example/api/webhooks/delivery", { method: "POST", headers: { "x-api-key": key, ...(length ? { "content-length": length } : {}) }, body });
  assert.equal((await POST(request("{}", "wrong"))).status, 401);
  assert.equal((await POST(request("not-json"))).status, 400);
  assert.equal((await POST(request("{}", token, "300000"))).status, 413);
  assert.equal((await POST(request('"' + "x".repeat(300000) + '"'))).status, 413);
  assert.equal((await POST(request("{}"))).status, 200);
});

test("webhook transaction failures return a retryable response", async t => {
  setup(t);
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async () => { throw Error("database failure"); } });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  const response = await POST(new Request("https://store.example/api/webhooks/delivery", { method: "POST", headers: { "x-api-key": token }, body: JSON.stringify(payload) }));
  assert.equal(response.status, 503);
});

test("only admins can retrieve webhook setup and it never includes the API password", async t => {
  setup(t);
  const auth = t.mock.method(authContext, "current", async () => null);
  assert.equal((await GET()).status, 403);
  auth.mock.mockImplementation(async () => ({ id: "a", email: "a@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  const response = await GET();
  assert.equal(response.status, 200); assert.match(response.headers.get("cache-control") || "", /no-store/);
  const body = await response.json(); assert.equal(body.token, token); assert.equal(body.header, "x-api-key");
  assert.equal(body.url, "https://zerasworld.in/api/webhooks/delivery");
  assert.equal(JSON.stringify(body).includes("private-api-password"), false);
});
