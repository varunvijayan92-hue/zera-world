import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request);
    const { id } = await params;
    const parsed = z.object({ reference: z.string().trim().min(3).max(150) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Enter the courier remittance or cash receipt reference.");
    await prisma.$transaction(async tx => {
      const order = await tx.customerOrder.findUnique({ where: { id } });
      if (!order || order.status !== "DELIVERED" || !order.deliveredAt) throw new AccessError("Confirm delivery before recording COD payment received.");
      const payment = await tx.paymentTransaction.findFirst({ where: { orderId: id, provider: "COD" } });
      if (!payment) throw new AccessError("COD payment record not found.", 404);
      if (payment.paymentStatus === "PAID") return;
      if (payment.paymentStatus !== "PENDING" || Number(payment.amount) !== Number(order.totalAmount)) throw new AccessError("This COD payment requires admin reconciliation.", 409);
      await tx.paymentTransaction.update({ where: { id: payment.id }, data: { paymentStatus: "PAID", gatewayPaymentId: `COD:${parsed.data.reference}`, verificationTimestamp: new Date() } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "COD_PAYMENT_RECEIVED", entityType: "CustomerOrder", entityId: id, details: { reference: parsed.data.reference, amount: Number(payment.amount) } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "COD payment receipt recorded." });
  } catch (error) { return apiError(error); }
}
