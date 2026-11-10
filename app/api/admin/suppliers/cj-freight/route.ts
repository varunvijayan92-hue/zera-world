import { NextResponse } from "next/server";
import { z } from "zod";
import { cjFreightQuote } from "@/lib/cj-catalog";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import { cheapestApprovedCjMethod, cjOrderPolicySchema } from "@/lib/cj-order-policy";

const schema = z.object({ variantId: z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9-]+$/), origin: z.string().regex(/^[A-Z]{2}$/), pincode: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  try {
    await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Enter a CJ variant ID, two-letter origin country and six-digit Indian PIN code.");
    const options = await cjFreightQuote(parsed.data);
    const saved = await prisma.integrationSetting.findUnique({ where: { provider: "CJ_DROPSHIPPING" }, select: { options: true } });
    const settings = saved?.options && typeof saved.options === "object" && !Array.isArray(saved.options) ? saved.options : {};
    const policy = cjOrderPolicySchema.safeParse(settings.orderPolicy);
    const cheapest = policy.success && policy.data.origin === parsed.data.origin ? cheapestApprovedCjMethod(options, policy.data.trackedMethods) : null;
    return NextResponse.json({ options, cheapestApproved: cheapest?.name || null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
