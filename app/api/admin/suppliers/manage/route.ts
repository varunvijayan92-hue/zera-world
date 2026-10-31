import { supplierLoginIdSchema } from "@/lib/supplier-credentials";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SOURCE_TYPE"), supplierId: z.string().min(1), sourceType: z.enum(["DIRECT", "EXTERNAL_SITE"]) }),
  z.object({ action: z.literal("EXTERNAL_PURCHASE"), supplierId: z.string().min(1), sku: z.string().trim().min(1), quantity: z.coerce.number().int().min(1).max(100000), unitCost: z.coerce.number().finite().nonnegative().max(1000000), purchaseUrl: z.string().url().refine((value) => ["https:", "http:"].includes(new URL(value).protocol)), reference: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal("INVITE"), loginId: supplierLoginIdSchema.optional(), supplierId: z.string().min(1), fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().transform((value) => value.toLowerCase()), password: z.string().min(12).refine((value) => Buffer.byteLength(value) <= 72) }),
  z.object({ action: z.literal("APPROVE"), supplierId: z.string().min(1), status: z.enum(["ACTIVE", "INACTIVE"]) }),
  z.object({ action: z.literal("ASSIGN_PRODUCT"), supplierId: z.string().min(1), sku: z.string().trim().min(1) }),
  z.object({ action: z.literal("SETTLEMENT"), supplierId: z.string().min(1), amount: z.coerce.number().finite().positive().max(100000000), reference: z.string().trim().min(2).max(100), notes: z.string().max(500).default(""), paidAt: z.string().date() }),
  z.object({ action: z.literal("SUPPORT_REPLY"), ticketId: z.string().min(1), reply: z.string().trim().min(2).max(3000) }),
]);
export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json()); if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Invalid supplier details.");
    const body = parsed.data;
    if (body.action === "INVITE" && actor.role !== "ADMIN") throw new AccessError("Only administrators can grant login access.", 403);
    const newLoginId = body.action === "INVITE" ? body.loginId || `sup-${randomUUID().slice(0, 18)}` : undefined;
    const passwordHash = body.action === "INVITE" ? await bcrypt.hash(body.password, 12) : "";
    await prisma.$transaction(async (tx) => {
      if (body.action === "SUPPORT_REPLY") {
        await tx.supportTicket.update({ where: { id: body.ticketId }, data: { reply: body.reply, status: "ANSWERED" } });
      } else {
        const supplier = await tx.supplier.findUnique({ where: { id: body.supplierId } }); if (!supplier) throw new AccessError("Supplier not found.", 404);
        if (body.action === "INVITE") {
          if (supplier.sourceType !== "DIRECT") throw new AccessError("Supplier login is available for direct suppliers. External sites are managed through sourcing records.");
          if (await tx.user.findFirst({ where: { OR: [{ email: { equals: body.email, mode: "insensitive" } }, { loginId: newLoginId }] } })) throw new AccessError("This email already has an account. Use a separate supplier email.", 409);
          const user = await tx.user.create({ data: { loginId: newLoginId, email: body.email, fullName: body.fullName, passwordHash, role: "SUPPLIER" } });
          await tx.supplierContact.create({ data: { supplierId: supplier.id, userId: user.id, name: body.fullName, email: body.email } });
        } else if (body.action === "SOURCE_TYPE") await tx.supplier.update({ where: { id: supplier.id }, data: { sourceType: body.sourceType } });
        else if (body.action === "EXTERNAL_PURCHASE") {
          if (supplier.sourceType !== "EXTERNAL_SITE") throw new AccessError("Choose an external-site supplier.");
          const product = await tx.product.findUnique({ where: { sku: body.sku } });
          if (!product || product.supplierId !== supplier.id) throw new AccessError("Assign this product to the external-site supplier first.");
          await tx.purchaseOrder.create({ data: { supplierId: supplier.id, orderNumber: `SRC-${randomUUID()}`, status: "CONFIRMED", totalAmount: body.unitCost * body.quantity, notes: JSON.stringify({ purchaseUrl: body.purchaseUrl, externalReference: body.reference }), items: { create: { productId: product.id, sku: product.sku, quantity: body.quantity, unitCost: body.unitCost } } } });
        } else if (body.action === "APPROVE") await tx.supplier.update({ where: { id: supplier.id }, data: { status: body.status } });
        else if (body.action === "ASSIGN_PRODUCT") {
          const product = await tx.product.findUnique({ where: { sku: body.sku } }); if (!product) throw new AccessError("Product SKU not found.", 404);
          if (product.supplierId && product.supplierId !== supplier.id) {
            if (await tx.inventory.count({ where: { productId: product.id, supplierId: product.supplierId, reservedQty: { gt: 0 } } })) throw new AccessError("Resolve the previous supplier's reserved stock before reassigning.");
            await tx.inventory.updateMany({ where: { productId: product.id, supplierId: product.supplierId, warehouseId: null }, data: { availableQty: 0 } });
          } else if (!product.supplierId) {
            await tx.inventory.updateMany({ where: { productId: product.id, supplierId: null, warehouseId: null }, data: { supplierId: supplier.id } });
          }
          await tx.product.update({ where: { id: product.id }, data: { supplierId: supplier.id } });
        } else await tx.supplierSettlement.create({ data: { supplierId: supplier.id, amount: body.amount, reference: body.reference, notes: body.notes, paidAt: new Date(`${body.paidAt}T12:00:00+05:30`) } });
      }
      await tx.auditLog.create({ data: { userId: actor.id, action: body.action, entityType: "Supplier", details: { action: body.action } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: body.action === "INVITE" ? `Supplier login created. Login ID: ${newLoginId}. Share the password privately; no invitation email has been sent.` : "Supplier record updated." });
  } catch (error) { return apiError(error); }
}
