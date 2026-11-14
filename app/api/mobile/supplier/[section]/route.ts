import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ section: string }> }) {
  try {
    const { supplier, user } = await supplierAccess();
    const { section } = await context.params;
    const where = { supplierId: supplier.id };
    let data: unknown;
    switch (section) {
      case "dashboard":
        data = { orderLines: await prisma.orderItem.count({ where }), products: await prisma.product.count({ where }), shipments: await prisma.shipment.count({ where }), returns: await prisma.returnRequest.count({ where }) };
        break;
      case "orders":
      case "notifications":
        data = await prisma.orderItem.findMany({ where, take: 200, orderBy: { createdAt: "desc" }, select: { id: true, quantity: true, fulfillmentStatus: true, status: true, costPrice: true, product: { select: { name: true, sku: true } }, customerOrder: { select: { id: true, marketplaceOrderId: true, status: true, createdAt: true } } } });
        break;
      case "products":
        data = await prisma.product.findMany({ where, take: 100, orderBy: { id: "asc" }, select: { id: true, name: true, sku: true, status: true, costPrice: true, hsnCode: true, imageUrls: true, inventory: { where: { supplierId: supplier.id, warehouseId: null }, select: { availableQty: true } } } });
        break;
      case "shipments":
        data = await prisma.shipment.findMany({ where, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, trackingNumber: true, courierName: true, status: true, customerOrder: { select: { marketplaceOrderId: true } }, trackingEvents: { take: 10, orderBy: { eventTime: "desc" }, select: { eventType: true, description: true, eventTime: true } } } });
        break;
      case "returns":
        data = await prisma.returnRequest.findMany({ where, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, reason: true, quantity: true, status: true, returnType: true, adminNotes: true, supplierReceivedAt: true } });
        break;
      case "payments":
      case "reports":
        data = await prisma.supplierSettlement.findMany({ where, take: 100, orderBy: { paidAt: "desc" }, select: { id: true, amount: true, paidAt: true, reference: true, notes: true } });
        break;
      case "local-customers":
        data = await prisma.supplierLocalCustomer.findMany({ where, take: 100, orderBy: { createdAt: "desc" }, select: { id: true, name: true, phone: true, email: true, address: true, notes: true } });
        break;
      case "support":
        data = await prisma.supportTicket.findMany({ where: { userId: user.id }, take: 50, orderBy: { createdAt: "desc" }, select: { id: true, subject: true, message: true, status: true, reply: true } });
        break;
      case "profile":
        data = { companyName: supplier.companyName, contactName: supplier.contactName, phone: supplier.phone };
        break;
      case "pickup-address":
        data = { pickupAddress: supplier.pickupAddress, pickupCity: supplier.pickupCity, pickupState: supplier.pickupState, pickupPincode: supplier.pickupPincode, contactName: supplier.contactName, phone: supplier.phone };
        break;
      case "company-profile":
        data = { companyName: supplier.companyName, companyEmail: supplier.companyEmail, companyPhone: supplier.companyPhone, companyAddress: supplier.companyAddress, gstNumber: supplier.gstNumber, companyRegistrationNumber: supplier.companyRegistrationNumber, companyLicenseNumber: supplier.companyLicenseNumber, companyProfileNotes: supplier.companyProfileNotes };
        break;
      default:
        throw new AccessError("Unknown supplier section.", 404);
    }
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
