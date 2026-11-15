import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

export async function GET(request: Request, { params }: { params: Promise<{ section: string; id: string }> }) {
  try {
    const { supplier, user } = await supplierAccess(request);
    const { section, id } = await params;
    const where = { id, supplierId: supplier.id };
    let data: unknown;
    switch (section) {
      case "orders":
      case "notifications": data = await prisma.orderItem.findFirst({ where, select: {
        id: true, quantity: true, fulfillmentStatus: true, status: true, costPrice: true,
        product: { select: { id: true, name: true, sku: true, imageUrls: true } },
        customerOrder: { select: { id: true, marketplaceOrderId: true, customerName: true, shippingAddress: true, status: true, createdAt: true } },
      } }); break;
      case "products": data = await prisma.product.findFirst({ where, select: { id: true, name: true, sku: true, description: true, status: true, costPrice: true, hsnCode: true, imageUrls: true, inventory: { where: { supplierId: supplier.id }, select: { id: true, availableQty: true, reservedQty: true } } } }); break;
      case "shipments": data = await prisma.shipment.findFirst({ where, include: { trackingEvents: { orderBy: { eventTime: "desc" }, take: 100 } } }); break;
      case "returns": data = await prisma.returnRequest.findFirst({ where, select: { id: true, reason: true, quantity: true, status: true, returnType: true, adminNotes: true, supplierReceivedAt: true } }); break;
      case "payments":
      case "reports": data = await prisma.supplierSettlement.findFirst({ where }); break;
      case "local-customers": data = await prisma.supplierLocalCustomer.findFirst({ where }); break;
      case "support": data = await prisma.supportTicket.findFirst({ where: { id, userId: user.id }, select: { id: true, subject: true, message: true, status: true, reply: true, createdAt: true } }); break;
      default: throw new AccessError("This section does not have a record detail endpoint.", 404);
    }
    if (!data) throw new AccessError("Record not found.", 404);
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
