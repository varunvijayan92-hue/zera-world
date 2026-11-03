import { prisma } from "./prisma";
import { AccessError } from "./portal-access";
export function returnRefundControls(payments: { provider: string; paymentStatus: string; gatewayPaymentId?: string | null }[]) {
  const isCod = payments.some(payment => payment.provider === "COD");
  const canGatewayRefund = !isCod && payments.some(payment => payment.provider === "RAZORPAY" && ["PAID", "PARTIALLY_REFUNDED"].includes(payment.paymentStatus) && !!payment.gatewayPaymentId);
  return { isCod, canGatewayRefund };
}
export async function saveReturnRefund(refundId: string, gateway: { id: string; payment_id: string; amount?: number | string; currency: string; status?: string }) {
  await prisma.$transaction(async (tx) => {
    const refund = await tx.refund.findUnique({ where: { id: refundId }, include: { returnRequest: { select: { customerOrderId: true } } } });
    if (!refund || Number(gateway.amount) !== Math.round(Number(refund.amount) * 100) || gateway.currency !== refund.currency) throw new AccessError("The gateway refund does not match the store record.");
    const orderId = refund.returnRequest.customerOrderId;
    const payment = await tx.paymentTransaction.findFirst({ where: { orderId, gatewayPaymentId: gateway.payment_id, provider: "RAZORPAY" } });
    if (!payment) throw new AccessError("Refund payment reference does not match this order.");
    // Processed refunds are final; a stale gateway response cannot downgrade them.
    if (refund.status === "SUCCESS" && gateway.status !== "processed") return;
    await tx.refund.update({ where: { id: refundId }, data: { gatewayRefundId: gateway.id, status: gateway.status === "processed" ? "SUCCESS" : gateway.status === "failed" ? "FAILED" : "PENDING" } });
    if (gateway.status === "processed") {
      const total = await tx.refund.aggregate({ where: { returnRequest: { customerOrderId: orderId }, status: "SUCCESS" }, _sum: { amount: true } });
      const full = Math.round(Number(total._sum.amount || 0) * 100) >= Math.round(Number(payment.amount || 0) * 100);
      await tx.paymentTransaction.updateMany({ where: { id: payment.id, paymentStatus: { in: ["PAID", "PARTIALLY_REFUNDED"] } }, data: { paymentStatus: full ? "REFUNDED" : "PARTIALLY_REFUNDED" } });
    }
  }, { isolationLevel: "Serializable" });
}
