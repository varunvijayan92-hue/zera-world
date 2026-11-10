import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjCatalogRequest } from "@/lib/cj-catalog";
import { verifiedCjMappingIds } from "@/lib/cj-mapping-verification";

const schema = z.object({ productId: z.string().min(1).max(100), mappingId: z.string().min(1).max(100), status: z.enum(["ACTIVE", "DISABLED"]) });
export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const input = schema.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Choose a valid mapping and status.");
    const { productId, mappingId, status } = input.data;
    const mapping = await prisma.supplierProductMapping.findFirst({ where: { id: mappingId, productId, supplier: { provider: "CJ_DROPSHIPPING", status: "ACTIVE", sourceType: "EXTERNAL_SITE" } } });
    if (!mapping) throw new AccessError("CJ mapping not found or supplier is inactive.", 404);
    if (status === "ACTIVE") {
      if (mapping.mappingStatus !== "DISABLED" || !mapping.externalProductId) throw new AccessError("Sync CJ variants to verify this mapping before activating it.", 409);
      const cj = await cjCatalogRequest("query", new URLSearchParams({ pid: mapping.externalProductId }));
      const [mappings, variants] = await Promise.all([
        prisma.supplierProductMapping.findMany({ where: { productId, supplierId: mapping.supplierId, externalProductId: mapping.externalProductId } }),
        prisma.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } }),
      ]);
      let verified: string[] = [];
      try { verified = verifiedCjMappingIds(mapping.externalProductId, mappings.map(row => row.id === mappingId ? { ...row, mappingStatus: "PENDING" } : row), variants, cj.data); } catch { throw new AccessError("CJ could not verify this mapping.", 502); }
      if (!verified.includes(mappingId)) throw new AccessError("This mapping does not match CJ. Sync or correct it before activating.", 409);
      const data = cj.data as { variants?: { vid?: unknown; variantKey?: unknown }[] };
      const variant = data.variants?.find(row => row.vid === mapping.supplierVariantId);
      if (mapping.supplierVariantKey && variant?.variantKey !== mapping.supplierVariantKey) throw new AccessError("The CJ colour or size changed. Sync the product before activating.", 409);
    } else if (mapping.mappingStatus !== "ACTIVE") throw new AccessError("Only active mappings can be marked inactive.", 409);
    await prisma.$transaction(async tx => {
      if (status === "ACTIVE") {
        const product = await tx.product.findUnique({ where: { id: productId }, select: { supplierId: true } });
        if (product?.supplierId !== mapping.supplierId) throw new AccessError("Assign this CJ supplier to the product before activating the mapping.", 409);
      }
      const changed = await tx.supplierProductMapping.updateMany({ where: { id: mappingId, productId, mappingStatus: mapping.mappingStatus, externalProductId: mapping.externalProductId, supplierVariantId: mapping.supplierVariantId, supplierSku: mapping.supplierSku, variantId: mapping.variantId }, data: { mappingStatus: status, supplierStockQty: null, supplierAvailability: "UNKNOWN", lastStockCheckAt: null } });
      if (changed.count !== 1) throw new AccessError("Mapping changed; refresh and try again.", 409);
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE_CJ_MAPPING_STATUS", entityType: "SupplierProductMapping", entityId: mappingId, details: { productId, status } } });
    });
    return NextResponse.json({ message: status === "ACTIVE" ? "Mapping verified and active. Refresh CJ stock before selling." : "Mapping inactive for this store. CJ’s connection is unchanged." });
  } catch (error) { return apiError(error); }
}
