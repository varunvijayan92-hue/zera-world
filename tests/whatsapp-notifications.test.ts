import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { queueOrderWhatsApp, whatsappEventId, deliverWhatsAppNotifications, whatsappEventDelivery, whatsappOrderSettings, orderMessageSummary } from "../lib/whatsapp-notifications";

function enabled(t: TestContext) {
  const original = process.env.WHATSAPP_NOTIFICATIONS_ENABLED;
  process.env.WHATSAPP_NOTIFICATIONS_ENABLED = "true";
  t.after(() => { if (original === undefined) delete process.env.WHATSAPP_NOTIFICATIONS_ENABLED; else process.env.WHATSAPP_NOTIFICATIONS_ENABLED = original; });
}

test("order events have stable deduplication keys and separate supplier shipment references", async t => {
  enabled(t);
  const saved = new Map<string, any>();
  const tx = { customerOrder: { findUnique: async () => ({ customerId: "customer" }) }, whatsAppNotification: { upsert: async (args: any) => {
    assert.deepEqual(args.update, {});
    if (!saved.has(args.where.id)) saved.set(args.where.id, args.create);
    return saved.get(args.where.id);
  } } };
  await queueOrderWhatsApp(tx as any, "order", "PAYMENT_RECEIVED");
  await queueOrderWhatsApp(tx as any, "order", "PAYMENT_RECEIVED");
  assert.equal(saved.size, 1);
  assert.notEqual(whatsappEventId("order", "SHIPPED", "shipment-a"), whatsappEventId("order", "SHIPPED", "shipment-b"));
});

test("workers respect opt-out, suppress duplicate claims and never retry uncertain sends", async t => {
  enabled(t);
  const original = prisma.whatsAppNotification, originalPayment = prisma.paymentTransaction;
  let state = "QUEUED", consent = false, sends = 0, uncertain = false;
  const entry = { id: whatsappEventId("order", "PAYMENT_RECEIVED"), event: "PAYMENT_RECEIVED", orderId: "order", reference: "", createdAt: new Date(),
    user: { phone: "9876543210", isActive: true, get whatsappPreference() { return { enabled: consent }; } },
    order: { marketplaceOrderId: "ORDER-1", customerName: "Test customer", totalAmount: "499.00", status: "CONFIRMED", shipments: [] } };
  Object.assign(prisma, { whatsAppNotification: {
    findMany: async ({ where }: any) => where.status === state ? [entry] : [],
    updateMany: async () => { if (!["QUEUED", "BLOCKED"].includes(state)) return { count: 0 }; state = "SENDING"; return { count: 1 }; },
    findUniqueOrThrow: async () => entry,
    update: async ({ data }: any) => { state = data.status; return entry; },
  }, paymentTransaction: { findFirst: async () => ({ id: "paid" }) } });
  t.after(() => Object.assign(prisma, { whatsAppNotification: original, paymentTransaction: originalPayment }));
  t.mock.method(whatsappOrderSettings, "read", async () => ({ PAYMENT_RECEIVED: "44404" }));
  t.mock.method(whatsappEventDelivery, "prepare", async (message: any) => { assert.deepEqual(message.variables, ["499.00"]); return { message: { ...message, phoneNumberId: "sender" }, fingerprint: "fingerprint" }; });
  t.mock.method(whatsappEventDelivery, "send", async () => { sends++; if (uncertain) throw Error("timeout"); return { requestId: "W-test", status: "ACCEPTED" }; });
  await deliverWhatsAppNotifications();
  assert.equal(state, "SKIPPED"); assert.equal(sends, 0);
  state = "QUEUED"; consent = true;
  await Promise.all([deliverWhatsAppNotifications(), deliverWhatsAppNotifications()]);
  assert.equal(state, "ACCEPTED"); assert.equal(sends, 1);
  state = "QUEUED"; uncertain = true;
  await deliverWhatsAppNotifications();
  assert.equal(state, "UNKNOWN");
  await deliverWhatsAppNotifications(5, true);
  assert.equal(sends, 2);
});

test("customer order summaries contain order totals and shipment tracking details", () => {
  const order = { marketplaceOrderId: "ORDER-123", customerName: "Buyer", totalAmount: "499", status: "CONFIRMED" };
  assert.match(orderMessageSummary("ORDER_PLACED", order), /ORDER-123.*INR 499.00/);
  assert.match(orderMessageSummary("SHIPPED", order, { courierName: "Delhivery", trackingNumber: "AWB123" }), /Delhivery.*AWB123/);
  assert.match(orderMessageSummary("DELIVERED", order), /delivered/);
});
