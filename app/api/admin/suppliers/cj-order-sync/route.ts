import { NextResponse } from "next/server";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjOrderSyncStatus } from "@/lib/cj-catalog";

export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    if (user.role !== "ADMIN") throw new AccessError("Only administrators can check CJ order sync status.", 403);
    return NextResponse.json(cjOrderSyncStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
