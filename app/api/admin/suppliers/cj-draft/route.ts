import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjCatalogRequest } from "@/lib/cj-catalog";
import { cjProductDetails } from "@/lib/cj-reference";
import { parseCjSyncVariants, planCjVariantSync } from "@/lib/cj-variant-sync";

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const input = z.object({ cjProductId: z.string().regex(/^[a-zA-Z0-9-]{1,100}$/), supplierId: z.string().trim().min(1).max(100) }).safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Choose a CJ product and supplier.");
    const { cjProductId, supplierId } = input.data;
    const response = await cjCatalogRequest("query", new URLSearchParams({ pid: cjProductId }));
    const details = cjProductDetails(response.data);
    if (!details || details.id !== cjProductId || !details.sku) throw new AccessError("CJ did not provide a valid product name and SKU.", 502);
    let incoming: ReturnType<typeof parseCjSyncVariants>;
    try { incoming = parseCjSyncVariants(cjProductId, response.data); } catch { throw new AccessError("CJ did not provide a valid variant list.", 502); }
    const product = await prisma.$transaction(async tx => {
      const supplier = await tx.supplier.findFirst({ where: { id: supplierId, provider: "CJ_DROPSHIPPING", sourceType: "EXTERNAL_SITE", status: "ACTIVE" }, select: { id: true } });
      if (!supplier) throw new AccessError("Select an active CJ supplier.");
      const existing = await tx.supplierProductMapping.findFirst({ where: { externalProductId: cjProductId, supplier: { provider: "CJ_DROPSHIPPING" } }, select: { productId: true } });
      if (existing) throw new AccessError("This CJ product is already mapped to a store product. Open it in Products or sync its variants.", 409);
      if (await tx.product.findUnique({ where: { sku: details.sku }, select: { id: true } })) throw new AccessError("This product SKU already exists. Edit the existing product instead.", 409);
      const collisions = await tx.productVariant.findMany({ where: { sku: { in: incoming.map(item => item.variantSku) } }, select: { id: true, productId: true, sku: true, variantName: true } });
      const created = await tx.product.create({ data: { name: details.name, sku: details.sku, supplierId, status: "DRAFT", gstRate: 0, returnDays: 0, isReturnable: false } });
      let plan: ReturnType<typeof planCjVariantSync>;
      try { plan = planCjVariantSync({ productId: created.id, supplierId, cjProductId, incoming, variants: collisions, mappings: [], newId: randomUUID }); }
      catch { throw new AccessError("A variant SKU is already used by another product. Review the existing mapping.", 409); }
      await tx.productVariant.createMany({ data: plan.newVariants });
      await tx.supplierProductMapping.createMany({ data: plan.newMappings.map(row => ({ ...row, supplierVariantKey: incoming.find(v => v.vid === row.supplierVariantId)?.variantKey || null })) });
      await tx.auditLog.create({ data: { userId: actor.id, action: "IMPORT_CJ_DRAFT", entityType: "Product", entityId: created.id, details: { cjProductId, variants: incoming.length } } });
      return created;
    }, { isolationLevel: "Serializable", timeout: 30000 });
    revalidatePath("/admin/products"); revalidatePath("/admin/suppliers/cj");
    return NextResponse.json({ productId: product.id, variants: incoming.length, message: "Draft created with CJ variant mappings. Add pricing, category, colour/size options and Cloudinary photos before publishing." }, { status: 201 });
  } catch (error) { return apiError(error); }
}
