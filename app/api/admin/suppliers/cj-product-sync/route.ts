import { NextResponse } from "next/server";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjProductSyncStatus } from "@/lib/cj-catalog";

export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    if (user.role !== "ADMIN") throw new AccessError("Only administrators can check CJ product sync status.", 403);
    return NextResponse.json(cjProductSyncStatus(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
