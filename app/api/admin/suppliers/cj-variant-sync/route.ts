import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjCatalogRequest } from "@/lib/cj-catalog";
import { parseCjSyncVariants, planCjVariantSync } from "@/lib/cj-variant-sync";

const schema = z.object({ productId: z.string().trim().min(1).max(100), cjProductId: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/) });

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Select a store product and a valid CJ product.");
    const { productId, cjProductId } = parsed.data;
    const cj = await cjCatalogRequest("query", new URLSearchParams({ pid: cjProductId }));
    let incoming: ReturnType<typeof parseCjSyncVariants>;
    try { incoming = parseCjSyncVariants(cjProductId, cj.data); }
    catch (error) { throw new AccessError(error instanceof Error ? error.message : "CJ product data is invalid.", 502); }
    const result = await prisma.$transaction(async tx => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { supplierId: true, supplier: { select: { status: true, sourceType: true, provider: true } } } });
      if (!product?.supplierId || product.supplier?.status !== "ACTIVE" || product.supplier.sourceType !== "EXTERNAL_SITE" || product.supplier.provider !== "CJ_DROPSHIPPING") throw new AccessError("Assign the store product to an active CJdropshipping supplier first.");
      const [existingVariants, mappings] = await Promise.all([
        tx.productVariant.findMany({ where: { OR: [{ productId }, { sku: { in: incoming.map(item => item.variantSku) } }] }, select: { id: true, productId: true, sku: true, variantName: true } }),
        tx.supplierProductMapping.findMany({ where: { productId, supplierId: product.supplierId } }),
      ]);
      let plan: ReturnType<typeof planCjVariantSync>;
      try { plan = planCjVariantSync({ productId, supplierId: product.supplierId, cjProductId, incoming, variants: existingVariants, mappings, newId: randomUUID }); }
      catch (error) { throw new AccessError(error instanceof Error ? error.message : "CJ mapping conflicts with an existing product.", 409); }
      const { newVariants, newMappings, updates, activateMappingIds, stale } = plan;
      if (newVariants.length) await tx.productVariant.createMany({ data: newVariants });
      for (const update of updates) await tx.productVariant.update({ where: { id: update.id }, data: { variantName: update.name } });
      if (newMappings.length) await tx.supplierProductMapping.createMany({ data: newMappings });
      if (activateMappingIds.length) {
        const updated = await tx.supplierProductMapping.updateMany({ where: { id: { in: activateMappingIds }, productId, supplierId: product.supplierId, mappingStatus: "PENDING" }, data: { mappingStatus: "ACTIVE" } });
        if (updated.count !== activateMappingIds.length) throw new AccessError("Mappings changed during synchronization. Refresh and try again.", 409);
      }
      await tx.auditLog.create({ data: { userId: actor.id, action: "SYNC_CJ_VARIANTS", entityType: "Product", entityId: productId, details: { cjProductId, received: incoming.length, added: newVariants.length, stale } } });
      return { received: incoming.length, added: newVariants.length, updated: updates.length, mappingsAdded: newMappings.length, stale };
    }, { isolationLevel: "Serializable", timeout: 30000 });
    for (const path of ["/admin/products", "/admin/suppliers/cj", "/admin/product-sync"]) revalidatePath(path);
    return NextResponse.json({ ...result, message: `Synced ${result.received} CJ variants; ${result.added} added, ${result.updated} names updated, ${result.mappingsAdded} new mappings verified. ${result.stale} old mapping(s) need review. Selling prices, stock, photos and website colour/size options were not changed.` });
  } catch (error) { return apiError(error); }
}
