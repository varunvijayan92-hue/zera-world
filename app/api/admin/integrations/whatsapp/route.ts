import { NextResponse } from "next/server";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { whatsappMetadata } from "@/lib/whatsapp";

export async function GET(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    if (actor.role !== "ADMIN") throw new AccessError("Administrator access required.", 403);
    const data = await whatsappMetadata();
    return NextResponse.json({ data, message: data.approvedTemplates ? "WhatsApp connection loaded. Approved templates are available." : "WhatsApp setup loaded. An approved template is required before sending." }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
