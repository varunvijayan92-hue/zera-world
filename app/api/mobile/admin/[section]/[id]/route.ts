import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { publicUserSelect } from "@/lib/admin-operations";
import { GET as readProduct } from "@/app/api/mobile/products/[id]/route";

export async function GET(request: Request, { params }: { params: Promise<{ section: string; id: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { section, id } = await params;
    let data: unknown;
    switch (section) {
      case "products": return readProduct(request, { params: Promise.resolve({ id }) });
      case "suppliers": data = await prisma.supplier.findUnique({ where: { id }, select: {
        id: true, companyName: true, contactName: true, email: true, phone: true, status: true, sourceType: true, provider: true,
        pickupAddress: true, pickupAddressLine1: true, pickupAddressLine2: true, pickupCity: true, pickupDistrict: true, pickupState: true,
        pickupCountry: true, pickupLandmark: true, pickupPincode: true, companyEmail: true, companyPhone: true, companyAddress: true,
        gstNumber: true, gstRegistered: true, gstRate: true,
      } }); break;
      case "orders":
      case "invoices":
        data = await prisma.customerOrder.findUnique({ where: { id }, include: {
          orderItems: { include: { product: { select: { id: true, name: true, sku: true, imageUrls: true } } } },
          shipments: { include: { trackingEvents: { orderBy: { eventTime: "desc" }, take: 100 } } },
        } });
        break;
      case "customers":
        data = await prisma.user.findFirst({ where: { id, role: "CUSTOMER" }, select: { ...publicUserSelect, addresses: true, _count: { select: { customerOrders: true } } } });
        break;
      case "users": data = await prisma.user.findUnique({ where: { id }, select: publicUserSelect }); break;
      case "returns": data = await prisma.returnRequest.findUnique({ where: { id }, include: { refunds: true } }); break;
      case "inventory": data = await prisma.inventory.findUnique({ where: { id }, include: { product: { select: { id: true, name: true, sku: true } } } }); break;
      case "fulfillment":
      case "shipments":
      case "tracking": data = await prisma.shipment.findUnique({ where: { id }, include: { trackingEvents: { orderBy: { eventTime: "desc" }, take: 100 } } }); break;
      case "categories": data = await prisma.storeCategory.findUnique({ where: { id } }); break;
      case "payments": data = await prisma.paymentTransaction.findUnique({ where: { id }, select: { id: true, orderId: true, provider: true, gatewayPaymentId: true, amount: true, currency: true, paymentStatus: true, createdAt: true } }); break;
      case "gift-cards": data = await prisma.customerVoucher.findUnique({ where: { id }, include: { customer: { select: { id: true, fullName: true, email: true } } } }); break;
      case "profit-expenses": data = await prisma.expense.findUnique({ where: { id } }); break;
      case "product-sync": data = await prisma.syncJob.findUnique({ where: { id }, select: { id: true, jobType: true, status: true, startedAt: true, completedAt: true, errorMessage: true, createdAt: true } }); break;
      case "support": data = await prisma.supportTicket.findUnique({ where: { id }, include: { user: { select: { id: true, fullName: true, email: true } } } }); break;
      case "contact-messages": data = await prisma.auditLog.findFirst({ where: { id, action: "CONTACT_REQUEST", entityType: "ContactMessage" }, select: { id: true, entityId: true, details: true, createdAt: true } }); break;
      default: throw new AccessError("This section does not have a record detail endpoint.", 404);
    }
    if (!data) throw new AccessError("Record not found.", 404);
    if (section === "orders" || section === "invoices") {
      const payments = await prisma.paymentTransaction.findMany({ where: { orderId: id }, orderBy: { createdAt: "desc" },
        select: { id: true, provider: true, paymentStatus: true, amount: true, currency: true, gatewayPaymentId: true } });
      data = { ...data as object, payments, receiptNotice: "Order summary; not a separately numbered tax invoice." };
    }
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
