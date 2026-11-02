import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { integrationCredentials } from "@/lib/integration-settings";
import { SITE_URL } from "@/lib/seo";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return NextResponse.json({ message: "Administrator access required." }, { status: 403 });
  const credentials = await integrationCredentials("SHIPROCKET");
  if (!credentials.webhookToken) return NextResponse.json({ message: "Webhook token has not been configured." }, { status: 503 });
  return NextResponse.json({ url: `${SITE_URL}/api/webhooks/delivery`, header: "x-api-key", token: credentials.webhookToken }, { headers: { "Cache-Control": "no-store, private", "Vary": "Cookie" } });
}
