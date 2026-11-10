import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError, apiError, portalUser } from "@/lib/portal-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request);
    const { id } = await params;
    const input = z.object({ quantity: z.number().int().min(0).max(1000000) }).safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Enter a whole stock quantity from 0 to 1,000,000.");
    const result = await prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id }, select: { supplierId: true } });
      if (!product) throw new AccessError("Product not found.", 404);
      const rows = await tx.inventory.findMany({ where: { productId: id } });
      if (rows.length > 1 || (rows.length === 1 && (rows[0].warehouseId || rows[0].status !== "AVAILABLE"))) throw new AccessError("This product has multiple or warehouse stock records. Adjust stock in Inventory instead.", 409);
      const row = rows[0];
      if (row && input.data.quantity < row.reservedQty) throw new AccessError(`Quantity cannot be below ${row.reservedQty} reserved units.`, 409);
      if (row) await tx.inventory.update({ where: { id: row.id }, data: { availableQty: input.data.quantity, lastUpdatedAt: new Date() } });
      else await tx.inventory.create({ data: { productId: id, supplierId: product.supplierId, availableQty: input.data.quantity } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE_MANUAL_PRODUCT_STOCK", entityType: "Product", entityId: id, details: { previous: row?.availableQty ?? null, quantity: input.data.quantity } } });
      return { total: input.data.quantity, reserved: row?.reservedQty ?? 0 };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) { return apiError(error); }
}
