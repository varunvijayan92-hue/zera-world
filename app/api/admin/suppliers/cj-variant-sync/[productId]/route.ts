import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError } from "@/lib/portal-access";
import { AccessError } from "@/lib/portal-access";
import { z } from "zod";

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { productId } = await params;
    const [variants, mappings] = await Promise.all([
      prisma.productVariant.findMany({ where: { productId }, select: { id: true, variantName: true, sku: true }, orderBy: { variantName: "asc" } }),
      prisma.supplierProductMapping.findMany({ where: { productId, supplier: { provider: "CJ_DROPSHIPPING" } }, select: { id: true, variantId: true, externalProductId: true, supplierVariantId: true, supplierSku: true, packagingSku: true, mappingStatus: true } }),
    ]);
    return NextResponse.json({ variants, mappings });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    const user = await portalUser("ADMIN", request);
    const { productId } = await params;
    const input = z.object({ mappingId: z.string().min(1).max(100), packagingSku: z.string().trim().max(200) }).safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Enter a valid packaging SKU.");
    await prisma.$transaction(async tx => {
      const updated = await tx.supplierProductMapping.updateMany({ where: { id: input.data.mappingId, productId, supplier: { provider: "CJ_DROPSHIPPING" } }, data: { packagingSku: input.data.packagingSku || null } });
      if (updated.count !== 1) throw new AccessError("CJ mapping not found.", 404);
      await tx.auditLog.create({ data: { userId: user.id, action: "UPDATE_CJ_PACKAGING_SKU", entityType: "SupplierProductMapping", entityId: input.data.mappingId, details: { productId } } });
    });
    return NextResponse.json({ message: "Packaging SKU saved. This does not create a packaging connection in CJ." });
  } catch (error) { return apiError(error); }
}
