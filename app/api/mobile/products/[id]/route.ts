import { NextResponse } from "next/server";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import { readProductExtras } from "@/lib/product-pricing";

export { PATCH, DELETE } from "@/app/api/products/[id]/route";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { id } = await params;
    const product = await prisma.product.findUnique({ where: { id }, include: {
      supplier: { select: { id: true, companyName: true, status: true, sourceType: true, provider: true } },
      inventory: true,
    } });
    if (!product) throw new AccessError("Product not found.", 404);
    const extras = await readProductExtras([id]);
    return NextResponse.json({ data: { ...product, ...extras.get(id), availableQty: product.inventory.reduce((sum, row) => sum + row.availableQty, 0) } });
  } catch (error) { return apiError(error); }
}
