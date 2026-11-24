import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { supportMailClient } from "./support-mail";
import { AccessError } from "./portal-access";
import { sendWhatsAppText } from "./whatsapp";

export function supportThread(...parts: string[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

export const supportInbox = {
  async receive(messages: Prisma.SupportMessageCreateManyInput[]) {
    if (messages.length) await prisma.supportMessage.createMany({ data: messages, skipDuplicates: true });
  },
};

export async function sendSupportReply(thread: string, replyId: string, body: string, actorId: string) {
  const incoming = await prisma.supportMessage.findFirst({
    where: { thread, direction: "INBOUND" }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  if (!incoming) throw new AccessError("Conversation not found.", 404);
  const id = `reply:${replyId}`;
  const previous = await prisma.supportMessage.findUnique({ where: { id } });
  if (previous) {
    if (previous.thread === thread && previous.actorId === actorId && previous.body === body && previous.status === "ACCEPTED") return;
    throw new AccessError("This reply was already submitted. Check the conversation before trying again.", 409);
  }

  if (incoming.channel === "WHATSAPP" && Date.now() - incoming.createdAt.getTime() >= 86_400_000) {
    throw new AccessError("The WhatsApp reply window has closed. A new customer message opens another 24-hour window.", 409);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (incoming.channel === "EMAIL" && !apiKey) throw new AccessError("Email sending is not configured.", 503);
  await prisma.supportMessage.create({ data: {
    id, thread, actorId, body, channel: incoming.channel, peer: incoming.peer, senderId: incoming.senderId,
    subject: incoming.subject, direction: "OUTBOUND", status: "PENDING",
  } });
  try {
    let externalId: string;
    if (incoming.channel === "WHATSAPP") {
      externalId = await sendWhatsAppText(incoming.senderId || "", incoming.peer, body);
    } else {
      const reference = incoming.externalId && /^<[^<>\s]+>$/.test(incoming.externalId) ? incoming.externalId : null;
      const result = await supportMailClient.create(apiKey!).emails.send({
        from: `Zera's World Support <${process.env.RESEND_FORWARD_FROM || "support@zerasworld.in"}>`,
        to: incoming.peer, text: body, subject: `Re: ${incoming.subject || "(No subject)"}`,
        ...(reference && { headers: { "In-Reply-To": reference, References: reference } }),
      }, { idempotencyKey: id });
      if (result.error || !result.data?.id) throw new AccessError("Resend did not confirm acceptance.", 502);
      externalId = result.data.id;
    }
    await prisma.supportMessage.update({ where: { id }, data: { status: "ACCEPTED", externalId } });
  } catch (error) {
    await prisma.supportMessage.update({ where: { id }, data: { status: "UNCONFIRMED" } }).catch(() => {});
    throw error;
  }
}
