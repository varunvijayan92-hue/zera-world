import { NextResponse } from "next/server";
import { z } from "zod";
import { cjCatalogProducts, cjCatalogRequest, cjCatalogVariants } from "@/lib/cj-catalog";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjProductDetails, cjProductReference } from "@/lib/cj-reference";

export async function GET(request: Request) {
  try {
    await portalUser("ADMIN");
    const params = new URL(request.url).searchParams;
    const productId = params.get("productId");
    if (productId !== null) {
      const parsed = z.string().trim().min(1).max(100).regex(/^[a-zA-Z0-9-]+$/).safeParse(productId);
      if (!parsed.success) throw new AccessError("Enter a valid CJ product ID.");
      const result = await cjCatalogRequest("query", new URLSearchParams({ pid: parsed.data }));
      return NextResponse.json({ variants: cjCatalogVariants(result.data) }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const reference = cjProductReference(params.get("q") || "");
    if (!reference) throw new AccessError("Enter a product name, SKU, CJ product ID or valid CJ product link.");
    if (reference.productId) {
      const result = await cjCatalogRequest("query", new URLSearchParams({ pid: reference.productId }));
      const product = cjProductDetails(result.data);
      if (!product || product.id !== reference.productId) throw new AccessError("CJ did not return that product. Check the link or ID and try again.", 404);
      return NextResponse.json({ products: [product], variants: cjCatalogVariants(result.data), selectedProductId: product.id }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const result = await cjCatalogRequest("listV2", new URLSearchParams({ page: "1", size: "20", keyWord: reference.keyword! }));
    return NextResponse.json({ products: cjCatalogProducts(result.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
