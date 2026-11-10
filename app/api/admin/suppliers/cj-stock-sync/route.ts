import { NextResponse } from "next/server";
import { z } from "zod";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { refreshCjVariantStock } from "@/lib/cj-variant-stock";

export async function POST(request: Request) {
  try {
    await portalUser("ADMIN", request);
    const input = z.object({ productId: z.string().trim().min(1).max(100), cjProductId: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/) }).safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Choose a store product and enter a valid CJ product ID.");
    const result = await refreshCjVariantStock(input.data.productId, input.data.cjProductId);
    return NextResponse.json({ ...result, message: `CJ reported stock for ${result.updated} variants in ${result.origin}; ${result.unavailable} could not be verified. This does not enable checkout or place orders.` });
  } catch (error) {
    if (error instanceof Error && !(error instanceof AccessError)) return NextResponse.json({ message: "Could not refresh CJ stock. Check the CJ connection and warehouse settings, then retry." }, { status: 502 });
    return apiError(error);
  }
}
