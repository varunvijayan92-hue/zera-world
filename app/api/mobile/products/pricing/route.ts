import { NextResponse } from "next/server";
import { portalUser, apiError } from "@/lib/portal-access";
import { calculateMobilePricing } from "@/lib/mobile-product-pricing";

export async function POST(request: Request) {
  try {
    await portalUser("ADMIN", request);
  } catch (error) { return apiError(error); }
  try {
    return NextResponse.json({ data: calculateMobilePricing(await request.json()) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Invalid pricing input." }, { status: 400 });
  }
}
