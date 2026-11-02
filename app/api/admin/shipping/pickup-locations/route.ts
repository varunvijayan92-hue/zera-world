import { NextResponse } from "next/server";
import { portalUser, apiError } from "@/lib/portal-access";
import { shiprocketPickupLocations } from "@/lib/shiprocket";

export async function GET() {
  try {
    await portalUser("ADMIN");
    return NextResponse.json({ locations: await shiprocketPickupLocations() }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}
