import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await portalUser("ADMIN", request); const { id } = await params;
    await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({ where: { id } });
      if (!order) throw new AccessError("Order not found.", 404);
      if (order.deliveredAt) throw new AccessError("Delivery is already confirmed.", 409);
      if (!["SHIPPED", "PROCESSING", "CONFIRMED"].includes(order.status)) throw new AccessError("Only confirmed, processing or shipped orders can be delivered.");
      const payment = await tx.paymentTransaction.findFirst({ where: { orderId: id, paymentStatus: "PAID" } });
      if (!payment) throw new AccessError("A verified paid payment is required before delivery confirmation.");
      await tx.customerOrder.update({ where: { id }, data: { status: "DELIVERED", deliveredAt: new Date(), orderItems: { updateMany: { where: {}, data: { status: "DELIVERED", fulfillmentStatus: "DELIVERED" } } }, shipments: { updateMany: { where: {}, data: { status: "DELIVERED" } } } } });
      await tx.auditLog.create({ data: { userId: user.id, action: "CONFIRM_DELIVERY", entityType: "CustomerOrder", entityId: id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Delivery confirmed. Product return windows start now." });
  } catch (error) { return apiError(error); }
}
