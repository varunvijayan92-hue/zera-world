import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { integrationCredentials } from "@/lib/integration-settings";
import { planCjPackagingSync } from "@/lib/cj-packaging-sync";

export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    const parsed = z.object({ productId: z.string().min(1).max(100) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Select a product.");
    const product = await prisma.product.findUnique({ where: { id: parsed.data.productId }, select: { supplierId: true, supplier: { select: { status: true, provider: true } } } });
    if (!product?.supplierId || product.supplier?.status !== "ACTIVE" || product.supplier.provider !== "CJ_DROPSHIPPING") throw new AccessError("Assign an active CJ supplier first.");
    const mappings = await prisma.supplierProductMapping.findMany({ where: { productId: parsed.data.productId, supplierId: product.supplierId, mappingStatus: "ACTIVE", supplierVariantId: { not: null }, externalProductId: { not: null } } });
    if (!mappings.length || mappings.length > 100) throw new AccessError("The product needs 1–100 active CJ variant mappings.");
    const ids = mappings.map(m => m.supplierVariantId!);
    if (new Set(ids).size !== ids.length) throw new AccessError("Duplicate variant mappings need review.", 409);
    const { apiKey } = await integrationCredentials("CJ_DROPSHIPPING");
    if (!apiKey) throw new AccessError("CJ API key is not configured.", 503);
    const base = "https://developers.cjdropshipping.com/api2.0/v1";
    const authResponse = await fetch(`${base}/authentication/getAccessToken`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    const auth = await authResponse.json();
    if (!authResponse.ok || auth.code !== 200 || auth.result !== true || typeof auth.data?.accessToken !== "string") throw new AccessError("CJ authentication failed.", 502);
    const headers = { "CJ-Access-Token": auth.data.accessToken };
    const shopsResponse = await fetch(`${base}/shop/getShops`, { headers, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    const shops = await shopsResponse.json();
    const active = Array.isArray(shops.data) ? shops.data.filter((shop: { type?: unknown; status?: unknown }) => shop.type === "api" && shop.status === 1) : [];
    if (!shopsResponse.ok || active.length !== 1 || typeof active[0].id !== "string") throw new AccessError("Could not identify a single active CJ API store.", 409);
    const resultResponse = await fetch(`${base}/product/packaging/connection/query`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ vidList: ids }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    const result = await resultResponse.json();
    if (!resultResponse.ok || result.code !== 200 || result.result !== true || !Array.isArray(result.data)) throw new AccessError("CJ could not return packaging connections.", 502);
    const { updates, conflicts } = planCjPackagingSync(mappings, result.data, active[0].id);
    await prisma.$transaction(async tx => {
      for (const row of updates) {
        const updated = await tx.supplierProductMapping.updateMany({ where: { id: row.id, productId: parsed.data.productId, supplierId: product.supplierId!, mappingStatus: "ACTIVE", packagingSku: row.previous, externalProductId: row.productId, supplierVariantId: row.variantId }, data: { packagingSku: row.sku } });
        if (updated.count !== 1) throw new AccessError("A mapping changed during sync. Refresh and retry.", 409);
      }
      if (updates.length) await tx.auditLog.create({ data: { userId: user.id, action: "SYNC_CJ_PACKAGING_SKUS", entityType: "Product", entityId: parsed.data.productId, details: { updated: updates.length } } });
    });
    return NextResponse.json({ message: `Imported ${updates.length} existing CJ packaging SKU(s). ${conflicts} conflicting or multiple assignments need review. This does not create packaging in CJ.` });
  } catch (error) { return apiError(error); }
}
