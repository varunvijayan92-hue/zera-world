import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { rateLimited } from "@/lib/rate-limit";
import { prepareWhatsAppMessage, sendWhatsAppMessage, whatsappMessageSchema } from "@/lib/whatsapp";

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    if (actor.role !== "ADMIN") throw new AccessError("Only administrators can send WhatsApp messages.", 403);
    const parsed = whatsappMessageSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check the WhatsApp message fields.");
    if (rateLimited(request, `whatsapp:${actor.id}`, 10, 60000)) throw new AccessError("Wait before sending more messages.", 429);
    const { message, fingerprint } = await prepareWhatsAppMessage(parsed.data);
    const id = `whatsapp-${actor.id}-${message.submissionId}`;
    const details = { fingerprint, messageId: message.messageId, phoneNumberId: message.phoneNumberId, recipientLast4: message.to.slice(-4) };
    try {
      await prisma.auditLog.create({ data: { id, userId: actor.id, action: "WHATSAPP_SEND_PENDING", entityType: "WhatsAppMessage", entityId: message.submissionId, details } });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
      const existing = await prisma.auditLog.findUnique({ where: { id } });
      const previous = existing?.details as Record<string, unknown> | undefined;
      if (previous?.fingerprint !== fingerprint) throw new AccessError("This submission ID was already used for different message details.", 409);
      if (existing?.action === "WHATSAPP_SEND_ACCEPTED") return NextResponse.json({ data: { requestId: previous.requestId, status: "ACCEPTED" }, message: "This message was already accepted by Fast2SMS. It was not sent again." });
      throw new AccessError("This send is pending or unconfirmed. Check Fast2SMS logs before retrying with a new submission ID.", 409);
    }
    let result: Awaited<ReturnType<typeof sendWhatsAppMessage>>;
    try { result = await sendWhatsAppMessage(message); }
    catch (error) {
      // Keep a durable claim even for timeouts: the provider may already have accepted the message.
      await prisma.auditLog.update({ where: { id }, data: { action: "WHATSAPP_SEND_UNCONFIRMED" } }).catch(() => {});
      throw error;
    }
    await prisma.auditLog.update({ where: { id }, data: { action: "WHATSAPP_SEND_ACCEPTED", details: { ...details, requestId: result.requestId } } });
    return NextResponse.json({ data: result, message: "Fast2SMS accepted the message. Acceptance does not confirm delivery." }, { status: 202 });
  } catch (error) { return apiError(error); }
}
