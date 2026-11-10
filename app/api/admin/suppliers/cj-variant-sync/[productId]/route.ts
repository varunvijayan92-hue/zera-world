import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError } from "@/lib/portal-access";

export async function GET(request: Request, { params }: { params: Promise<{ productId: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { productId } = await params;
    const [variants, mappings] = await Promise.all([
      prisma.productVariant.findMany({ where: { productId }, select: { id: true, variantName: true, sku: true }, orderBy: { variantName: "asc" } }),
      prisma.supplierProductMapping.findMany({ where: { productId, supplier: { provider: "CJ_DROPSHIPPING" } }, select: { variantId: true, externalProductId: true, supplierVariantId: true, supplierSku: true, mappingStatus: true } }),
    ]);
    return NextResponse.json({ variants, mappings });
  } catch (error) { return apiError(error); }
}
