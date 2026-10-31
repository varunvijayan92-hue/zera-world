import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = z.object({ orderItemId: z.string().min(1), quantity: z.coerce.number().int().min(1), reason: z.string().trim().min(10).max(2000) }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Enter the order item ID, quantity and RTO reason.");
    await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findUnique({ where: { id: parsed.data.orderItemId }, include: { customerOrder: true } });
      if (!item || !["SHIPPED", "PROCESSING", "CONFIRMED"].includes(item.customerOrder.status)) throw new AccessError("An undelivered confirmed order item is required for RTO.");
      const current = await tx.returnRequest.aggregate({ where: { orderItemId: item.id, status: { not: "REJECTED" } }, _sum: { quantity: true } });
      if (parsed.data.quantity + (current._sum.quantity || 0) > item.quantity) throw new AccessError("RTO quantity exceeds remaining item quantity.");
      const entry = await tx.returnRequest.create({ data: { orderItemId: item.id, customerId: item.customerOrder.customerId, supplierId: item.supplierId, customerOrderId: item.customerOrderId, quantity: parsed.data.quantity, reason: parsed.data.reason, returnType: "RTO", status: "APPROVED" } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "RECORD_RTO", entityType: "ReturnRequest", entityId: entry.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "RTO recorded. Confirm physical receipt before reviewing any refund." });
  } catch (error) { return apiError(error); }
}
