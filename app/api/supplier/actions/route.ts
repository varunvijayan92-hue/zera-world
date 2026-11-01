import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("RETURN_RECEIVED"), returnId: z.string().min(1) }),
  z.object({ action: z.literal("ORDER"), itemId: z.string(), status: z.enum(["ACCEPTED", "REJECTED", "PROCESSING", "PACKED"]) }),
  z.object({ action: z.literal("SHIPMENT"), itemId: z.string(), awb: z.string().regex(/^[a-zA-Z0-9-]{5,40}$/) }),
  z.object({ action: z.literal("STOCK"), productId: z.string(), stock: z.coerce.number().int().min(0).max(1000000), costPrice: z.coerce.number().finite().min(0).max(1000000) }),
  z.object({ action: z.literal("PRODUCT"), name: z.string().trim().min(2).max(150), sku: z.string().trim().min(1).max(80), description: z.string().max(5000), costPrice: z.coerce.number().finite().min(0).max(1000000), stock: z.coerce.number().int().min(0).max(1000000) }),
  z.object({ action: z.literal("PROFILE"), contactName: z.string().trim().max(100), phone: z.string().max(30), pickupAddress: z.string().trim().max(1000), gstNumber: z.string().trim().max(50).optional().or(z.literal("")), gstRegistered: z.coerce.boolean().optional().default(false), gstRate: z.coerce.number().finite().min(0).max(100).optional() }),
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
        const paid = await tx.paymentTransaction.findFirst({ where: { orderId: item.customerOrderId, paymentStatus: "PAID" } });
        if (!paid || ["CANCELLED", "REFUNDED", "DELIVERED", "RETURNED"].includes(item.customerOrder.status)) throw new AccessError("This order cannot be processed.");
        if (body.action === "ORDER") {
          const transitions: Record<string, string[]> = { PENDING: ["ACCEPTED", "REJECTED"], ACCEPTED: ["PROCESSING"], PROCESSING: ["PACKED"] };
          if (!transitions[item.fulfillmentStatus]?.includes(body.status)) throw new AccessError("Invalid order transition. Refresh the order.", 409);
          await tx.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: body.status } });
        } else {
          if (item.fulfillmentStatus !== "PACKED") throw new AccessError("Pack and confirm this item before dispatch.");
          const existing = await tx.shipment.findFirst({ where: { trackingNumber: body.awb } });
          if (existing) throw new AccessError("This AWB is already recorded. Review the existing shipment.", 409);
          await tx.shipment.create({ data: { customerOrderId: item.customerOrderId, supplierId: supplier.id, courierName: "Delhivery", trackingNumber: body.awb, status: "IN_TRANSIT", trackingEvents: { create: { eventType: "DISPATCHED", description: "Supplier entered the shipment AWB." } } } });
          await tx.orderItem.update({ where: { id: item.id }, data: { fulfillmentStatus: "SHIPPED", status: "SHIPPED" } });
          if (!await tx.orderItem.count({ where: { customerOrderId: item.customerOrderId, status: { not: "SHIPPED" } } })) await tx.customerOrder.update({ where: { id: item.customerOrderId }, data: { status: "SHIPPED" } });
        }
      } else if (body.action === "RETURN_RECEIVED") {
        const entry = await tx.returnRequest.findFirst({ where: { id: body.returnId, supplierId: supplier.id, status: "APPROVED" } });
        if (!entry) throw new AccessError("Approved supplier return not found.", 404);
        if (entry.supplierReceivedAt) throw new AccessError("Receipt has already been recorded.", 409);
        await tx.returnRequest.update({ where: { id: entry.id }, data: { supplierReceivedAt: new Date() } });
      } else if (body.action === "STOCK") {
        const product = await tx.product.findFirst({ where: { id: body.productId, supplierId: supplier.id } });
        if (!product) throw new AccessError("Product not found.", 404);
        // Supplier feed stock is separate from warehouse stock and cannot overwrite reserved stock.
        await tx.supplierProduct.upsert({ where: { supplierId_supplierProductCode: { supplierId: supplier.id, supplierProductCode: product.sku } }, create: { supplierId: supplier.id, productId: product.id, supplierProductCode: product.sku, purchasePrice: body.costPrice }, update: { purchasePrice: body.costPrice, lastUpdatedAt: new Date() } });
        const rows = await tx.inventory.findMany({ where: { productId: product.id, supplierId: supplier.id, warehouseId: null } });
        if (rows.length > 1) throw new AccessError("Multiple inventory rows require admin review.");
        if (rows[0]) {
          if (body.stock < rows[0].reservedQty) throw new AccessError("Stock cannot be lower than reserved quantity.");
          await tx.inventory.update({ where: { id: rows[0].id }, data: { availableQty: body.stock } });
        } else await tx.inventory.create({ data: { productId: product.id, supplierId: supplier.id, availableQty: body.stock } });
      } else if (body.action === "PRODUCT") {
        await tx.product.create({ data: { supplierId: supplier.id, name: body.name, sku: body.sku, description: body.description, costPrice: body.costPrice, status: "DRAFT", inventory: { create: { supplierId: supplier.id, availableQty: body.stock } } } });
      } else {
        await tx.supplier.update({ where: { id: supplier.id }, data: { contactName: body.contactName, phone: body.phone, pickupAddress: body.pickupAddress, gstNumber: body.gstNumber || null, gstRegistered: body.gstRegistered ?? supplier.gstRegistered, gstRate: body.gstRate ?? supplier.gstRate ?? null } });
      }
      await tx.auditLog.create({ data: { userId: user.id, action: `SUPPLIER_${body.action}`, entityType: "Supplier", entityId: supplier.id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: body.action === "PRODUCT" ? "Product submitted as a draft for admin approval." : "Supplier details updated." });
  } catch (error) { return apiError(error); }
}
