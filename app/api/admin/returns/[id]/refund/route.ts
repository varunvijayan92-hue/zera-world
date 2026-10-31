import { saveReturnRefund } from "@/lib/return-refund";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { razorpayGateway } from "@/lib/razorpay";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request); const { id } = await params;
    const claim = await prisma.$transaction(async (tx) => {
      const entry = await tx.returnRequest.findUnique({ where: { id }, include: { refunds: true } });
      if (!entry || entry.status !== "COMPLETED" || !entry.receivedAt || !entry.orderItemId) throw new AccessError("Receive and confirm the returned item before refunding.");
      if (entry.refunds.length) throw new AccessError("This return already has a refund record. Reconcile it instead of submitting again.", 409);
      const item = await tx.orderItem.findFirst({ where: { id: entry.orderItemId, customerOrderId: entry.customerOrderId } });
      if (!item || !item.unitPrice || item.gstRate === null || entry.quantity < 1 || entry.quantity > item.quantity) throw new AccessError("Order-time pricing is unavailable. Review this refund manually.");
      const payment = await tx.paymentTransaction.findFirst({ where: { orderId: entry.customerOrderId, provider: "RAZORPAY", paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } } });
      if (payment?.refundStatus && payment.refundStatus !== "NOT_REQUESTED") throw new AccessError("Another refund has been requested for this payment. Reconcile it before proceeding.");
      if (!payment?.gatewayPaymentId) throw new AccessError("Verified Razorpay payment not found.");
      const amountPaise = Math.round(Number(item.unitPrice) * 100) * entry.quantity;
      const refundPaise = amountPaise + Math.round(amountPaise * Number(item.gstRate) / 100);
      const existing = await tx.refund.aggregate({ where: { returnRequest: { customerOrderId: entry.customerOrderId }, status: { not: "FAILED" } }, _sum: { amount: true } });
      if (refundPaise < 100 || Math.round(Number(existing._sum.amount || 0) * 100) + refundPaise > Math.round(Number(payment.amount || 0) * 100)) throw new AccessError("Refund exceeds the remaining payment balance.");
      const refund = await tx.refund.create({ data: { returnRequestId: id, amount: refundPaise / 100, currency: payment.currency, status: "PENDING" } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "REQUEST_RETURN_REFUND", entityType: "ReturnRequest", entityId: id } });
      return { refund, paymentId: payment.gatewayPaymentId, amount: refundPaise };
    }, { isolationLevel: "Serializable" });
    // A timeout may still mean the gateway received the refund. Keep the claim pending
    // and require reconciliation rather than issuing a second refund automatically.
    const result = await razorpayGateway.refund(claim.paymentId, claim.amount, id);
    await saveReturnRefund(claim.refund.id, result);
    return NextResponse.json({ message: result.status === "processed" ? "Razorpay processed the return refund." : "Refund submitted. Reconcile its gateway status before recording it as completed." });
  } catch (error) { return apiError(error); }
}
