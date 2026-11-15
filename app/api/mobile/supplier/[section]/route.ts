import { mobileListQuery, mobileListMeta } from "@/lib/mobile-list";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ section: string }> }) {
  try {
    const { supplier, user } = await supplierAccess(request);
    const { section } = await context.params;
    let query;
    try { query = mobileListQuery(request); } catch (error) { throw new AccessError(error instanceof Error ? error.message : "Invalid pagination."); }
    const { page, limit, skip } = query;
    const where = { supplierId: supplier.id };
    let data: unknown;
    switch (section) {
      case "dashboard":
        data = { orderLines: await prisma.orderItem.count({ where }), products: await prisma.product.count({ where }), shipments: await prisma.shipment.count({ where }), returns: await prisma.returnRequest.count({ where }) };
        break;
      case "orders":
      case "notifications":
        data = await prisma.orderItem.findMany({ where, take: limit, skip, orderBy: { createdAt: "desc" }, select: { id: true, quantity: true, fulfillmentStatus: true, status: true, costPrice: true, product: { select: { name: true, sku: true } }, customerOrder: { select: { id: true, marketplaceOrderId: true, status: true, createdAt: true } } } });
        break;
      case "products":
        data = await prisma.product.findMany({ where, take: limit, skip, orderBy: { id: "asc" }, select: { id: true, name: true, sku: true, status: true, costPrice: true, hsnCode: true, imageUrls: true, inventory: { where: { supplierId: supplier.id, warehouseId: null }, select: { availableQty: true } } } });
        break;
      case "shipments":
        data = await prisma.shipment.findMany({ where, take: limit, skip, orderBy: { createdAt: "desc" }, select: { id: true, trackingNumber: true, courierName: true, status: true, customerOrder: { select: { marketplaceOrderId: true } }, trackingEvents: { take: 10, orderBy: { eventTime: "desc" }, select: { eventType: true, description: true, eventTime: true } } } });
        break;
      case "returns":
        data = await prisma.returnRequest.findMany({ where, take: limit, skip, orderBy: { createdAt: "desc" }, select: { id: true, reason: true, quantity: true, status: true, returnType: true, adminNotes: true, supplierReceivedAt: true } });
        break;
      case "payments":
      case "reports":
        data = await prisma.supplierSettlement.findMany({ where, take: limit, skip, orderBy: { paidAt: "desc" }, select: { id: true, amount: true, paidAt: true, reference: true, notes: true } });
        break;
      case "local-customers":
        data = await prisma.supplierLocalCustomer.findMany({ where, take: limit, skip, orderBy: { createdAt: "desc" }, select: { id: true, name: true, phone: true, email: true, address: true, notes: true } });
        break;
      case "support":
        data = await prisma.supportTicket.findMany({ where: { userId: user.id }, take: limit, skip, orderBy: { createdAt: "desc" }, select: { id: true, subject: true, message: true, status: true, reply: true } });
        break;
      case "profile":
        data = { companyName: supplier.companyName, contactName: supplier.contactName, phone: supplier.phone };
        break;
      case "pickup-address":
        data = { pickupAddress: supplier.pickupAddress, pickupAddressLine1: supplier.pickupAddressLine1, pickupAddressLine2: supplier.pickupAddressLine2, pickupCity: supplier.pickupCity, pickupDistrict: supplier.pickupDistrict, pickupState: supplier.pickupState, pickupCountry: supplier.pickupCountry, pickupLandmark: supplier.pickupLandmark, pickupPincode: supplier.pickupPincode, contactName: supplier.contactName, phone: supplier.phone };
        break;
      case "company-profile":
        data = { companyName: supplier.companyName, companyEmail: supplier.companyEmail, companyPhone: supplier.companyPhone, companyAddress: supplier.companyAddress, companyAddressLine1: supplier.companyAddressLine1, companyAddressLine2: supplier.companyAddressLine2, companyCity: supplier.companyCity, companyDistrict: supplier.companyDistrict, companyState: supplier.companyState, companyCountry: supplier.companyCountry, companyLandmark: supplier.companyLandmark, companyPincode: supplier.companyPincode, gstNumber: supplier.gstNumber, gstRegistered: supplier.gstRegistered, gstRate: supplier.gstRate, companyRegistrationNumber: supplier.companyRegistrationNumber, companyLicenseNumber: supplier.companyLicenseNumber, companyProfileNotes: supplier.companyProfileNotes };
        break;
      default:
        throw new AccessError("Unknown supplier section.", 404);
    }
    return NextResponse.json({ data, meta: mobileListMeta(data, page, limit) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
