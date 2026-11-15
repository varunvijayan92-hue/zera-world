import { createHash } from "node:crypto";
import { after } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { customerWhatsAppPhone } from "./customer-whatsapp";
import { integrationCredentials } from "./integration-settings";
import { prepareWhatsAppMessage, sendWhatsAppMessage } from "./whatsapp";

export type WhatsAppOrderEvent = "ORDER_PLACED" | "PAYMENT_RECEIVED" | "SHIPPED" | "DELIVERED";
export const whatsappEventDelivery = { prepare: prepareWhatsAppMessage, send: sendWhatsAppMessage };
export const whatsappOrderSettings = {
  async read() {
    const saved = await integrationCredentials("FAST2SMS_WHATSAPP");
    return { ORDER_PLACED: saved.orderTemplateId || process.env.FAST2SMS_WHATSAPP_ORDER_TEMPLATE_ID,
      PAYMENT_RECEIVED: saved.paymentTemplateId || process.env.FAST2SMS_WHATSAPP_PAYMENT_TEMPLATE_ID,
      SHIPPED: saved.shippedTemplateId || process.env.FAST2SMS_WHATSAPP_SHIPPED_TEMPLATE_ID,
      DELIVERED: saved.deliveredTemplateId || process.env.FAST2SMS_WHATSAPP_DELIVERED_TEMPLATE_ID };
  },
};

export function whatsappEventId(orderId: string, event: WhatsAppOrderEvent, reference = "") {
  return createHash("sha256").update(JSON.stringify([orderId, event, reference])).digest("hex");
}
export async function queueOrderWhatsApp(tx: Prisma.TransactionClient, orderId: string, event: WhatsAppOrderEvent, reference = "") {
  if (process.env.WHATSAPP_NOTIFICATIONS_ENABLED !== "true") return;
  const order = await tx.customerOrder.findUnique({ where: { id: orderId }, select: { customerId: true } });
  if (!order?.customerId) return;
  await tx.whatsAppNotification.upsert({ where: { id: whatsappEventId(orderId, event, reference) }, update: {},
    create: { id: whatsappEventId(orderId, event, reference), userId: order.customerId, orderId, event, reference } });
}

export function orderMessageSummary(event: WhatsAppOrderEvent, order: { marketplaceOrderId: string; customerName: string | null; totalAmount: unknown; status: string }, shipment?: { courierName: string | null; trackingNumber: string | null } | null) {
  const amount = `INR ${Number(order.totalAmount || 0).toFixed(2)}`;
  const name = (order.customerName || "Customer").replace(/[|\r\n\t]+/g, " ").trim();
  if (event === "PAYMENT_RECEIVED") return Number(order.totalAmount || 0).toFixed(2); // Existing payment_completed template's {{1}} is the amount.
  if (event === "SHIPPED") return `${name}, order ${order.marketplaceOrderId} (${amount}) has shipped. Courier: ${shipment?.courierName || "See My account"}. Tracking: ${shipment?.trackingNumber || "See My account"}.`;
  if (event === "DELIVERED") return `${name}, order ${order.marketplaceOrderId} (${amount}) is delivered.`;
  return `${name}, we received order ${order.marketplaceOrderId}. Total: ${amount}. Order status: ${order.status}.`;
}

export async function deliverWhatsAppNotifications(limit = 10, retryBlockedNow = false) {
  if (process.env.WHATSAPP_NOTIFICATIONS_ENABLED !== "true") return { processed: 0 };
  const batchSize = Math.max(1, Math.min(limit, 10));
  const queued = await prisma.whatsAppNotification.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" }, take: batchSize });
  const blocked = queued.length < batchSize ? await prisma.whatsAppNotification.findMany({ where: { status: "BLOCKED", ...(retryBlockedNow ? {} : { updatedAt: { lt: new Date(Date.now() - 300000) } }) }, orderBy: { createdAt: "asc" }, take: batchSize - queued.length }) : [];
  const candidates = [...queued, ...blocked];
  let processed = 0;
  for (const candidate of candidates) {
    const claimed = await prisma.whatsAppNotification.updateMany({ where: { id: candidate.id, status: { in: ["QUEUED", "BLOCKED"] } }, data: { status: "SENDING", attempts: { increment: 1 } } });
    if (claimed.count !== 1) continue;
    processed++;
    let sending = false;
    try {
      const entry = await prisma.whatsAppNotification.findUniqueOrThrow({ where: { id: candidate.id }, include: {
        user: { select: { phone: true, isActive: true, whatsappPreference: { select: { enabled: true } } } },
        order: { include: { shipments: { orderBy: { createdAt: "desc" } } } },
      } });
      if (!entry.user.isActive || !entry.user.whatsappPreference?.enabled || Date.now() - entry.createdAt.getTime() > 86400000) {
        await prisma.whatsAppNotification.update({ where: { id: entry.id }, data: { status: "SKIPPED", lastError: "Customer opted out, account inactive or event older than 24 hours." } }); continue;
      }
      const to = customerWhatsAppPhone.parse(entry.user.phone);
      const event = entry.event as WhatsAppOrderEvent;
      const settings = await whatsappOrderSettings.read();
      const messageId = settings[event];
      if (!messageId) throw new Error(`No approved template configured for ${event}.`);
      if (event === "PAYMENT_RECEIVED" && !await prisma.paymentTransaction.findFirst({ where: { orderId: entry.orderId, paymentStatus: "PAID" }, select: { id: true } })) {
        await prisma.whatsAppNotification.update({ where: { id: entry.id }, data: { status: "SKIPPED", lastError: "Payment is no longer paid." } }); continue;
      }
      const shipment = entry.order.shipments.find(item => item.id === entry.reference) || entry.order.shipments[0];
      const hash = entry.id;
      const submissionId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
      const prepared = await whatsappEventDelivery.prepare({ submissionId, messageId, to, variables: [orderMessageSummary(event, entry.order, shipment)] });
      sending = true;
      const result = await whatsappEventDelivery.send(prepared.message);
      await prisma.whatsAppNotification.update({ where: { id: entry.id }, data: { status: "ACCEPTED", requestId: result.requestId, lastError: null } });
    } catch {
      await prisma.whatsAppNotification.update({ where: { id: candidate.id }, data: { status: sending ? "UNKNOWN" : "BLOCKED",
        lastError: sending ? "Provider acceptance unknown. Check Fast2SMS logs; automatic retry is disabled." : "Check customer phone, sender connection and the event's approved template configuration." } }).catch(() => {});
    }
  }
  return { processed };
}

export function scheduleWhatsAppNotifications() {
  if (process.env.WHATSAPP_NOTIFICATIONS_ENABLED !== "true") return;
  try { after(async () => { await deliverWhatsAppNotifications().catch(() => {}); }); }
  catch { /* Durable queued events remain available to the administrator retry endpoint. */ }
}
