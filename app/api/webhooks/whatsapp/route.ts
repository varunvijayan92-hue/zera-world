import { createHmac, timingSafeEqual } from "node:crypto";
import { integrationCredentials } from "@/lib/integration-settings";

import { z } from "zod";
import { supportInbox, supportThread } from "@/lib/support-inbox";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const challenge = query.get("hub.challenge");
  const submitted = query.get("hub.verify_token");

  if (query.get("hub.mode") !== "subscribe" || !challenge || !submitted) {
    return new Response("Invalid verification request", { status: 400 });
  }

  const { verifyToken } = await integrationCredentials("META_WHATSAPP");
  const actual = Buffer.from(submitted);
  const expected = Buffer.from(verifyToken || "");
  if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return new Response("Verification failed", { status: 403 });
  }

  return new Response(challenge, { headers: { "Cache-Control": "no-store" } });
}

const incoming = z.object({
  id: z.string().min(1).max(512),
  from: z.string().regex(/^\d{6,15}$/),
  timestamp: z.coerce.number().int().positive(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  button: z.object({ text: z.string() }).optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string() }).optional(),
    list_reply: z.object({ title: z.string() }).optional(),
  }).optional(),
});
const webhook = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        metadata: z.object({ phone_number_id: z.string() }).optional(),
        messages: z.array(z.unknown()).optional(),
      }),
    })),
  })),
});

export async function POST(request: Request) {
  const { appSecret, wabaId, phoneNumberId } = await integrationCredentials("META_WHATSAPP");
  if (!appSecret || !wabaId || !phoneNumberId) return new Response("Webhook setup incomplete", { status: 503 });
  const raw = await request.text();
  const signature = request.headers.get("x-hub-signature-256") || "";
  if (!/^sha256=[a-f0-9]{64}$/i.test(signature)) return new Response("Invalid signature", { status: 403 });
  const expected = createHmac("sha256", appSecret).update(raw).digest();
  if (!timingSafeEqual(Buffer.from(signature.slice(7), "hex"), expected)) return new Response("Invalid signature", { status: 403 });

  let parsed;
  try { parsed = webhook.safeParse(JSON.parse(raw)); }
  catch { return new Response("Invalid webhook payload", { status: 400 }); }
  if (!parsed.success) return new Response("Invalid webhook payload", { status: 400 });
  const messages = parsed.data.entry.filter(entry => entry.id === wabaId).flatMap(entry =>
    entry.changes.filter(({ field, value }) => field === "messages" && value.metadata?.phone_number_id === phoneNumberId)
      .flatMap(({ value }) => value.messages || [])
  ).flatMap(rawMessage => {
    const message = incoming.safeParse(rawMessage);
    if (!message.success) return [];
    const { id, from, timestamp, type, text, button, interactive } = message.data;
    const createdAt = new Date(timestamp * 1000);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.getTime() > Date.now() + 300000) return [];
    const body = text?.body || button?.text || interactive?.button_reply?.title || interactive?.list_reply?.title || `[${type} message]`;
    return [{
      id: `whatsapp:${id}`, thread: supportThread("WHATSAPP", phoneNumberId, from), channel: "WHATSAPP", peer: from,
      senderId: phoneNumberId, body: body.slice(0, 10000), direction: "INBOUND", status: "RECEIVED", externalId: id, createdAt,
    }];
  });
  await supportInbox.receive(messages);
  return Response.json({ ok: true });
}
