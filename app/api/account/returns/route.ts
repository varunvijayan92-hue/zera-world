import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { returnEligibility } from "@/lib/returns";
export async function POST(request: Request) {
  try {
    const user = await portalUser("CUSTOMER", request);
    const parsed = z.object({ orderItemId: z.string().min(1), quantity: z.number().int().min(1).max(10), reason: z.string().trim().min(10).max(2000) }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Choose an item, quantity and a return reason of at least 10 characters.");
    await prisma.$transaction(async (tx) => {
      const item = await tx.orderItem.findFirst({ where: { id: parsed.data.orderItemId, customerOrder: { customerId: user.id, status: "DELIVERED" } }, include: { customerOrder: true } });
      if (!item) throw new AccessError("Delivered order item not found.", 404);
      const reason = returnEligibility(item, item.customerOrder.deliveredAt);
      if (reason) throw new AccessError(reason);
      const existing = await tx.returnRequest.aggregate({ where: { orderItemId: item.id, status: { not: "REJECTED" } }, _sum: { quantity: true } });
      if ((existing._sum.quantity || 0) + parsed.data.quantity > item.quantity) throw new AccessError("The requested quantity exceeds the remaining returnable quantity.");
      await tx.returnRequest.create({ data: { orderItemId: item.id, customerId: user.id, customerOrderId: item.customerOrderId, supplierId: item.supplierId, quantity: parsed.data.quantity, reason: parsed.data.reason, refundAmount: null } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Return requested. The store will review your reason and arrange the next steps." }, { status: 201 });
  } catch (error) { return apiError(error); }
}
