import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjCatalogRequest } from "@/lib/cj-catalog";
import { verifiedCjMappingIds } from "@/lib/cj-mapping-verification";

const schema = z.object({ productId: z.string().min(1).max(100), externalProductId: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/) });

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Select a valid product and CJ product ID.");
    const { productId, externalProductId } = parsed.data;
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { supplierId: true, supplier: { select: { status: true, sourceType: true, provider: true } } } });
    if (!product?.supplierId || product.supplier?.status !== "ACTIVE" || product.supplier.sourceType !== "EXTERNAL_SITE" || product.supplier.provider !== "CJ_DROPSHIPPING") throw new AccessError("Assign this product to an active CJ supplier first.");
    const cj = await cjCatalogRequest("query", new URLSearchParams({ pid: externalProductId }));
    const result = await prisma.$transaction(async tx => {
      const current = await tx.product.findUnique({ where: { id: productId }, select: { supplierId: true } });
      if (current?.supplierId !== product.supplierId) throw new AccessError("Product supplier changed; refresh and try again.", 409);
      const [mappings, variants] = await Promise.all([
        tx.supplierProductMapping.findMany({ where: { productId, supplierId: product.supplierId!, externalProductId } }),
        tx.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } }),
      ]);
      const verified = verifiedCjMappingIds(externalProductId, mappings, variants, cj.data);
      for (const id of verified) {
        const row = mappings.find(mapping => mapping.id === id)!;
        const updated = await tx.supplierProductMapping.updateMany({ where: { id, mappingStatus: "PENDING", externalProductId, supplierVariantId: row.supplierVariantId, supplierSku: row.supplierSku, variantId: row.variantId }, data: { mappingStatus: "ACTIVE" } });
        if (updated.count !== 1) throw new AccessError("A mapping changed; refresh and try again.", 409);
      }
      if (verified.length) await tx.auditLog.create({ data: { userId: actor.id, action: "VERIFY_CJ_PRODUCT_MAPPINGS", entityType: "Product", entityId: productId, details: { externalProductId, verifiedCount: verified.length } } });
      return { verified: verified.length, pending: mappings.filter(mapping => mapping.mappingStatus === "PENDING").length - verified.length };
    }, { isolationLevel: "Serializable", timeout: 30000 });
    revalidatePath("/admin/suppliers/cj");
    return NextResponse.json({ ...result, message: `${result.verified} mapping(s) verified against CJ; ${result.pending} still need review. Stock, price and automatic ordering are not checked or enabled.` });
  } catch (error) { return apiError(error); }
}
