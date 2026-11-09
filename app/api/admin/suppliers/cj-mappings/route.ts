import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjProductMappingSchema } from "@/lib/cj-product-mapping";

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = cjProductMappingSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Select a product and supplier, and enter the CJ product and variant IDs.");
    const input = parsed.data;
    await prisma.$transaction(async tx => {
      const [product, supplier, existing] = await Promise.all([
        tx.product.findUnique({ where: { id: input.productId }, select: { supplierId: true } }),
        tx.supplier.findUnique({ where: { id: input.supplierId }, select: { sourceType: true, status: true, provider: true } }),
        tx.supplierProductMapping.findMany({ where: { productId: input.productId, supplierId: input.supplierId }, select: { id: true } }),
      ]);
      if (!supplier || supplier.sourceType !== "EXTERNAL_SITE" || supplier.status !== "ACTIVE" || supplier.provider !== "CJ_DROPSHIPPING") throw new AccessError("Select an active CJdropshipping supplier.");
      if (!product || product.supplierId !== input.supplierId) throw new AccessError("Assign this supplier to the product in Products before mapping it.");
      if (existing.length > 1) throw new AccessError("Multiple mappings already exist. Resolve them before updating this product.", 409);
      const data = { externalProductId: input.externalProductId, supplierVariantId: input.supplierVariantId, supplierSku: input.supplierSku || null, supplierAvailability: "UNKNOWN", mappingStatus: "PENDING", lastStockCheckAt: null };
      const mapping = existing.length ? await tx.supplierProductMapping.update({ where: { id: existing[0].id }, data }) : await tx.supplierProductMapping.create({ data: { ...data, productId: input.productId, supplierId: input.supplierId } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "SAVE_CJ_PRODUCT_MAPPING", entityType: "SupplierProductMapping", entityId: mapping.id, details: { productId: input.productId, supplierId: input.supplierId } } });
    }, { isolationLevel: "Serializable" });
    revalidatePath("/admin/suppliers/cj"); revalidatePath("/admin/product-sync");
    return NextResponse.json({ message: "Mapping saved for review. CJ stock and automatic dispatch are not connected yet." });
  } catch (error) { return apiError(error); }
}
