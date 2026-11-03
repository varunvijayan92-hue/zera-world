import { fulfilmentPaymentWhere } from "@/lib/cash-on-delivery";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validators";
import { updateSupplierCatalog } from "@/lib/supplier-catalog";
import { updateSupplierProfile } from "@/lib/supplier-profile";
import { shipmentPickupLocation } from "@/lib/supplier-pickup";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("RETURN_RECEIVED"), returnId: z.string().min(1) }),
  z.object({ action: z.literal("ORDER"), itemId: z.string(), status: z.enum(["ACCEPTED", "REJECTED", "PROCESSING", "PACKED"]) }),
  z.object({ action: z.literal("SHIPMENT"), itemId: z.string(), courierName: z.enum(["Delhivery", "Shiprocket"]).default("Delhivery"), awb: z.string().regex(/^[a-zA-Z0-9-]{5,40}$/) }),
  z.object({ action: z.literal("STOCK"), productId: z.string(), stock: z.coerce.number().int().min(0).max(1000000), hsnCode: productSchema.shape.hsnCode, costPrice: z.coerce.number().finite().min(0).max(1000000).multipleOf(0.01) }),
  z.object({ action: z.literal("PRODUCT"), name: z.string().trim().min(2).max(150), sku: z.string().trim().min(1).max(80), description: z.string().max(5000), hsnCode: productSchema.shape.hsnCode, costPrice: z.coerce.number().finite().min(0).max(1000000).multipleOf(0.01), stock: z.coerce.number().int().min(0).max(1000000) }),
  z.object({
    action: z.literal("PROFILE"),
    contactName: z.string().trim().max(100).optional(),
    phone: z.string().max(30).optional(),
    companyPhone: z.string().max(30).optional().or(z.literal("")),
    companyEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
    pickupAddress: z.string().trim().max(1000).optional().or(z.literal("")),
    pickupAddressLine1: z.string().trim().max(200).optional().or(z.literal("")),
    pickupAddressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    pickupCity: z.string().trim().max(120).optional().or(z.literal("")),
    pickupDistrict: z.string().trim().max(120).optional().or(z.literal("")),
    pickupState: z.string().trim().max(120).optional().or(z.literal("")),
    pickupCountry: z.string().trim().max(120).optional().or(z.literal("")),
    pickupLandmark: z.string().trim().max(200).optional().or(z.literal("")),
    pickupPincode: z.string().trim().max(20).optional().or(z.literal("")),
    companyAddress: z.string().trim().max(1000).optional().or(z.literal("")),
    companyAddressLine1: z.string().trim().max(200).optional().or(z.literal("")),
    companyAddressLine2: z.string().trim().max(200).optional().or(z.literal("")),
    companyCity: z.string().trim().max(120).optional().or(z.literal("")),
    companyDistrict: z.string().trim().max(120).optional().or(z.literal("")),
    companyState: z.string().trim().max(120).optional().or(z.literal("")),
    companyCountry: z.string().trim().max(120).optional().or(z.literal("")),
    companyLandmark: z.string().trim().max(200).optional().or(z.literal("")),
    companyPincode: z.string().trim().max(20).optional().or(z.literal("")),
    companyRegistrationNumber: z.string().trim().max(100).optional().or(z.literal("")),
    companyLicenseNumber: z.string().trim().max(100).optional().or(z.literal("")),
    companyProfileNotes: z.string().trim().max(2000).optional().or(z.literal("")),
    gstNumber: z.string().trim().max(50).optional().or(z.literal("")),
    gstRegistered: z.coerce.boolean().optional(),
    gstRate: z.coerce.number().finite().min(0).max(100).optional()
  }),
]);
export async function POST(request: Request) {
  try {
    const { user, supplier } = await supplierAccess(request);
    const parsed = actions.safeParse(await request.json());
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check the supplier details.");
    const body = parsed.data;
    await prisma.$transaction(async (tx) => {
      if (body.action === "ORDER" || body.action === "SHIPMENT") {
        const item = await tx.orderItem.findFirst({ where: { id: body.itemId, supplierId: supplier.id }, include: { customerOrder: true } });
        if (!item) throw new AccessError("Assigned order item not found.", 404);
        const paid = await tx.paymentTransaction.findFirst({ where: fulfilmentPaymentWhere(item.customerOrderId) });
        if (!paid || ["CANCELLED", "REFUNDED", "DELIVERED", "RETURNED"].includes(item.customerOrder.status)) throw new AccessError("This order cannot be processed.");
        if (body.action === "ORDER") {
          const transitions: Record<string, string[]> = { PENDING: ["ACCEPTED", "REJECTED"], ACCEPTED: ["PROCESSING"], PROCESSING: ["PACKED"] };
          if (!transitions[item.fulfillmentStatus]?.includes(body.status)) throw new AccessError("Invalid order transition. Refresh the order.", 409);
          await tx.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: body.status } });
        } else {
          if (item.fulfillmentStatus !== "PACKED") throw new AccessError("Pack and confirm this item before dispatch.");
          const existing = await tx.shipment.findFirst({ where: { trackingNumber: body.awb } });
          if (existing) throw new AccessError("This AWB is already recorded. Review the existing shipment.", 409);
          const pickupLocation = await shipmentPickupLocation(tx, supplier.id, body.courierName);
          await tx.shipment.create({ data: { customerOrderId: item.customerOrderId, supplierId: supplier.id, pickupLocation, courierName: body.courierName, trackingNumber: body.awb, status: "IN_TRANSIT", trackingEvents: { create: { eventType: "DISPATCHED", description: "Supplier entered the shipment AWB." } } } });
          await tx.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: "SHIPPED", status: "SHIPPED" } });
          if (!await tx.orderItem.count({ where: { customerOrderId: item.customerOrderId, status: { not: "SHIPPED" } } })) await tx.customerOrder.update({ where: { id: item.customerOrderId }, data: { status: "SHIPPED" } });
        }
      } else if (body.action === "RETURN_RECEIVED") {
        const entry = await tx.returnRequest.findFirst({ where: { id: body.returnId, supplierId: supplier.id, status: "APPROVED" } });
        if (!entry) throw new AccessError("Approved supplier return not found.", 404);
        if (entry.supplierReceivedAt) throw new AccessError("Receipt has already been recorded.", 409);
        await tx.returnRequest.update({ where: { id: entry.id }, data: { supplierReceivedAt: new Date() } });
      } else if (body.action === "STOCK") {
        await updateSupplierCatalog(tx, supplier.id, body);
      } else if (body.action === "PRODUCT") {
        await tx.product.create({ data: { supplierId: supplier.id, name: body.name, sku: body.sku, description: body.description, hsnCode: body.hsnCode || null, costPrice: body.costPrice, status: "DRAFT", supplierProducts: { create: { supplierId: supplier.id, supplierProductCode: body.sku, purchasePrice: body.costPrice } }, inventory: { create: { supplierId: supplier.id, availableQty: body.stock } } } });
      } else {
        await updateSupplierProfile(tx, supplier.id, body);
      }
      await tx.auditLog.create({ data: { userId: user.id, action: `SUPPLIER_${body.action}`, entityType: "Supplier", entityId: supplier.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: body.action === "PRODUCT" ? "Product submitted as a draft for admin approval." : "Supplier details updated." });
  } catch (error) { return apiError(error); }
}
