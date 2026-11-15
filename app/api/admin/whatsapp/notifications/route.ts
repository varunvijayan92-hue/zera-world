import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { deliverWhatsAppNotifications, whatsappOrderSettings } from "@/lib/whatsapp-notifications";
import { rateLimited } from "@/lib/rate-limit";

async function authorize(request: Request) {
  const actor = await portalUser("ADMIN", request);
  if (actor.role !== "ADMIN") throw new AccessError("Administrator access required.", 403);
  return actor;
}
export async function GET(request: Request) {
  try {
    await authorize(request);
    const [templates, notifications] = await Promise.all([
      whatsappOrderSettings.read(),
      prisma.whatsAppNotification.findMany({ orderBy: { createdAt: "desc" }, take: 50,
        select: { id: true, event: true, status: true, requestId: true, attempts: true, lastError: true, createdAt: true, updatedAt: true, order: { select: { marketplaceOrderId: true } } } }),
    ]);
    return NextResponse.json({ data: { enabled: process.env.WHATSAPP_NOTIFICATIONS_ENABLED === "true", templates, notifications } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const actor = await authorize(request);
    const body = await request.json().catch(() => null);
    if (body?.action !== "RETRY_PENDING") throw new AccessError("Use the RETRY_PENDING action.");
    if (rateLimited(request, `whatsapp-retry:${actor.id}`, 3, 60000)) throw new AccessError("Wait before processing more WhatsApp updates.", 429);
    const data = await deliverWhatsAppNotifications(5, true);
    return NextResponse.json({ data, message: "Pending updates checked. Blocked templates need approval; unconfirmed sends are never automatically retried." });
  } catch (error) { return apiError(error); }
}
