import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError, apiError, portalUser } from "@/lib/portal-access";

const schema = z.object({
  productId: z.string().trim().min(1).max(100),
  cjProductId: z.string().trim().regex(/^[a-zA-Z0-9-]{1,100}$/),
  cjVariantId: z.string().trim().regex(/^[a-zA-Z0-9-]{1,100}$/),
  cjSku: z.string().trim().min(1).max(100),
  variantName: z.string().trim().min(1).max(255),
  optionKey: z.string().trim().max(255).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Enter a product ID, variant ID, CJ SKU and variant name.");
    const input = parsed.data;
    await prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id: input.productId }, select: { supplierId: true, supplier: { select: { status: true, sourceType: true, provider: true } } } });
      if (!product?.supplierId || product.supplier?.status !== "ACTIVE" || product.supplier.sourceType !== "EXTERNAL_SITE" || product.supplier.provider !== "CJ_DROPSHIPPING") throw new AccessError("Assign and save an active CJ supplier first.");
      if (await tx.supplierProductMapping.findFirst({ where: { productId: input.productId, supplierId: product.supplierId, externalProductId: { not: null, notIn: [input.cjProductId] } }, select: { id: true } })) throw new AccessError("This product is mapped to a different CJ product.", 409);
      if (await tx.supplierProductMapping.findFirst({ where: { supplierId: product.supplierId, OR: [{ supplierVariantId: input.cjVariantId }, { supplierSku: input.cjSku }] }, select: { id: true } })) throw new AccessError("This CJ variant ID or SKU is already mapped. Review the existing mapping.", 409);
      const existing = await tx.productVariant.findUnique({ where: { sku: input.cjSku } });
      if (existing && existing.productId !== input.productId) throw new AccessError("This SKU is already used by another product.", 409);
      if (existing && await tx.supplierProductMapping.findFirst({ where: { productId: input.productId, variantId: existing.id }, select: { id: true } })) throw new AccessError("This variant already has a supplier mapping.", 409);
      const variant = existing || await tx.productVariant.create({ data: { id: randomUUID(), productId: input.productId, sku: input.cjSku, variantName: input.variantName } });
      const mapping = await tx.supplierProductMapping.create({ data: { productId: input.productId, supplierId: product.supplierId, variantId: variant.id, externalProductId: input.cjProductId, supplierVariantId: input.cjVariantId, supplierSku: input.cjSku, supplierVariantKey: input.optionKey || null, supplierAvailability: "UNKNOWN", mappingStatus: "PENDING" } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "ADD_CJ_VARIANT_PENDING", entityType: "SupplierProductMapping", entityId: mapping.id, details: { productId: input.productId } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Variant saved as pending. Sync the CJ product to verify its ID and SKU before checkout can use it." }, { status: 201 });
  } catch (error) { return apiError(error); }
}
