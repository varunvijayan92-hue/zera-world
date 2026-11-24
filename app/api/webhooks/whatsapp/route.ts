import { timingSafeEqual } from "node:crypto";
import { integrationCredentials } from "@/lib/integration-settings";

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
