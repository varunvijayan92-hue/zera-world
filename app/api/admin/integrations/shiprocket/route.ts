import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { AccessError, apiError } from "@/lib/portal-access";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { shiprocketPickupLocations } from "@/lib/shiprocket";

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) throw new AccessError("Invalid origin.", 403);
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN") throw new AccessError("Administrator access required.", 403);
    if (rateLimited(request, `shiprocket-check:${user.id}`, 5, 60000)) throw new AccessError("Wait before checking the connection again.", 429);
    const locations = await shiprocketPickupLocations();
    return NextResponse.json({ message: `Shiprocket connected. ${locations.length} pickup location(s) found.`, locations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
