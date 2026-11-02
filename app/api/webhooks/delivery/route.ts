import { NextResponse } from "next/server";
import { integrationCredentials } from "@/lib/integration-settings";
import { recordDeliveryWebhook, validDeliveryToken } from "@/lib/delivery-webhook";

export const runtime = "nodejs";
const MAX_BYTES = 256 * 1024;

export async function POST(request: Request) {
  try {
    const credentials = await integrationCredentials("SHIPROCKET");
    if (!validDeliveryToken(request.headers.get("x-api-key"), credentials.webhookToken)) return NextResponse.json({ message: "Invalid webhook token." }, { status: 401 });
    if (Number(request.headers.get("content-length")) > MAX_BYTES) return NextResponse.json({ message: "Payload too large." }, { status: 413 });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let length = 0;
    if (reader) while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > MAX_BYTES) { await reader.cancel(); return NextResponse.json({ message: "Payload too large." }, { status: 413 }); }
      chunks.push(value);
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return NextResponse.json({ message: "Invalid JSON." }, { status: 400 }); }
    if (!await recordDeliveryWebhook(body)) return NextResponse.json({ message: "Invalid tracking payload." }, { status: 400 });
    return NextResponse.json({ received: true });
  } catch {
    // A non-200 response lets the sender retry a failed database transaction.
    return NextResponse.json({ message: "Tracking update could not be saved. Please retry." }, { status: 503 });
  }
}
