import { NextResponse } from "next/server";
import { z } from "zod";
import { cjFreightQuote } from "@/lib/cj-catalog";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

const schema = z.object({ variantId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9-]+$/), origin: z.string().regex(/^[A-Z]{2}$/), pincode: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  try {
    await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Enter a CJ variant ID, two-letter origin country and six-digit Indian PIN code.");
    const options = await cjFreightQuote(parsed.data);
    return NextResponse.json({ options }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
