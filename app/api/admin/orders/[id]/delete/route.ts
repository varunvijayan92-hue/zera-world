import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await portalUser("ADMIN", request);
    if (user.role !== "ADMIN") throw new AccessError("Only administrators can delete orders.", 403);
    const { id } = await params;
    await prisma.$transaction(async tx => {
      const order = await tx.customerOrder.findUnique({ where: { id }, select: { id: true, status: true, marketplaceOrderId: true } });
      if (!order) throw new AccessError("Order not found.", 404);
      if (order.status !== "PENDING") throw new AccessError("Only pending orders can be deleted.", 409);
      const [shipment, returnRequest] = await Promise.all([
        tx.shipment.findFirst({ where: { customerOrderId: id }, select: { id: true } }),
        tx.returnRequest.findFirst({ where: { customerOrderId: id }, select: { id: true } }),
      ]);
      if (shipment || returnRequest) throw new AccessError("This order has a shipment or return and cannot be deleted here.", 409);
      const payments = await tx.paymentTransaction.findMany({ where: { orderId: id } });
      if (payments.some(payment => payment.gatewayOrderId || payment.gatewayPaymentId || payment.giftCardId || !["FAILED", "CANCELLED"].includes(payment.paymentStatus))) {
        throw new AccessError("This order has a payment that may still be processed. Review it in Payments before deleting.", 409);
      }
      await tx.paymentTransaction.deleteMany({ where: { orderId: id } });
      await tx.supplierApprovalDecision.deleteMany({ where: { orderId: id } });
      await tx.customerOrder.delete({ where: { id } });
      await tx.auditLog.create({ data: { userId: user.id, action: "DELETE_PENDING_ORDER", entityType: "CustomerOrder", entityId: id, details: { orderReference: order.marketplaceOrderId } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Pending order deleted." });
  } catch (error) { return apiError(error); }
}
