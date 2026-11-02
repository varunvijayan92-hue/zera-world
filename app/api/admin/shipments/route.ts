import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { shipmentPickupLocation } from "@/lib/supplier-pickup";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
const schema = z.object({ orderId: z.string().min(1), supplierId: z.string().optional(), courierName: z.enum(["Delhivery", "Shiprocket"]).default("Delhivery"), awb: z.string().regex(/^[a-zA-Z0-9-]{5,40}$/), shipmentCost: z.coerce.number().finite().min(0).max(1000000) });
export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json()); if (!parsed.success) throw new AccessError("Check the order ID, AWB and shipment cost.");
    const body = parsed.data;
    await prisma.$transaction(async (tx) => {
      const order = await tx.customerOrder.findUnique({ where: { id: body.orderId }, include: { orderItems: { select: { supplierId: true } } } });
      if (!order || !["CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status)) throw new AccessError("Confirmed order not found.");
      if (body.supplierId && !order.orderItems.some((item) => item.supplierId === body.supplierId)) throw new AccessError("This supplier is not assigned to the order.");
      if (!await tx.paymentTransaction.findFirst({ where: { orderId: order.id, paymentStatus: "PAID" } })) throw new AccessError("A verified paid payment is required.");
      if (await tx.shipment.findFirst({ where: { trackingNumber: body.awb } })) throw new AccessError("This AWB is already recorded.", 409);
      const pickupLocation = await shipmentPickupLocation(tx, body.supplierId, body.courierName);
      await tx.shipment.create({ data: { customerOrderId: order.id, supplierId: body.supplierId || null, pickupLocation, courierName: body.courierName, trackingNumber: body.awb, shipmentCost: body.shipmentCost, status: "IN_TRANSIT", trackingEvents: { create: { eventType: "DISPATCHED", description: "Shipment recorded by store admin." } } } });
      await tx.orderItem.updateMany({ where: { customerOrderId: order.id, ...(body.supplierId ? { supplierId: body.supplierId } : {}) }, data: { status: "SHIPPED", fulfillmentStatus: "SHIPPED" } });
      if (!await tx.orderItem.count({ where: { customerOrderId: order.id, status: { not: "SHIPPED" } } })) await tx.customerOrder.update({ where: { id: order.id }, data: { status: "SHIPPED" } });
      await tx.auditLog.create({ data: { userId: user.id, action: "RECORD_SHIPMENT", entityType: "CustomerOrder", entityId: order.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Shipment recorded. Live tracking can now be refreshed." });
  } catch (error) { return apiError(error); }
}
