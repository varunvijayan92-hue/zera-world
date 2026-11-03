import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { courierDate } from "./courier-date";

export function validDeliveryToken(actual: string | null, expected: string | undefined) {
  if (!actual || actual.length > 256 || !expected || expected.length < 32) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(actual), hash(expected));
}

const text = z.string().max(1000).nullish();
const payloadSchema = z.object({
  awb: z.union([z.string(), z.number().int().positive()]).transform(String).pipe(z.string().regex(/^[a-zA-Z0-9-]{5,40}$/)).optional(),
  current_status: text, shipment_status: text, current_timestamp: text,
  scans: z.array(z.object({ date: text, status: text, "sr-status-label": text, activity: text, location: text })).max(500).nullish(),
});

export async function recordDeliveryWebhook(body: unknown) {
  const parsed = payloadSchema.safeParse(body);
  if (!parsed.success) return false;
  const payload = parsed.data;
  // Shiprocket's connection test may not contain an AWB. Never invent shipments.
  if (!payload.awb) return true;
  const events: { type: string; description: string; date: Date }[] = [];
  for (const scan of (payload.scans || []).slice(0, 50)) {
    const date = courierDate(scan.date);
    if (date) events.push({ type: (scan["sr-status-label"] || scan.status || "Update").slice(0, 100), description: [scan.location, scan.activity].filter(Boolean).join(" · ").slice(0, 500), date });
  }
  const status = payload.current_status || payload.shipment_status;
  const date = courierDate(payload.current_timestamp);
  if (status && date) events.push({ type: status.slice(0, 100), description: "Courier status update received through webhook.", date });
  if (!events.length) return true;
  await prisma.$transaction(async tx => {
    const shipments = await tx.shipment.findMany({ where: { trackingNumber: payload.awb, courierName: { equals: "Shiprocket", mode: "insensitive" } }, select: { id: true } });
    for (const shipment of shipments) for (const event of events) {
      const where = { shipmentId: shipment.id, eventType: event.type, eventTime: event.date };
      if (!await tx.trackingEvent.findFirst({ where })) await tx.trackingEvent.create({ data: { ...where, description: event.description } });
    }
    // Financial and delivery confirmation transitions remain audited admin actions.
  }, { isolationLevel: "Serializable" });
  return true;
}
