import { saveReturnRefund } from "@/lib/return-refund";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { razorpayGateway } from "@/lib/razorpay";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await portalUser("ADMIN", request); const { id } = await params;
    const refund = await prisma.refund.findUnique({ where: { id } });
    if (!refund?.gatewayRefundId) throw new AccessError("No gateway refund ID is available. Check the Razorpay dashboard before making any further refund.");
    const result = await razorpayGateway.fetchRefund(refund.gatewayRefundId);
    if (Number(result.amount) !== Math.round(Number(refund.amount) * 100)) throw new AccessError("Gateway refund amount does not match the store record.");
    await saveReturnRefund(id, result);
    return NextResponse.json({ message: `Refund status: ${result.status}.` });
  } catch (error) { return apiError(error); }
}
