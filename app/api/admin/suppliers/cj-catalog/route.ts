import { NextResponse } from "next/server";
import { z } from "zod";
import { cjCatalogProducts, cjCatalogRequest, cjCatalogVariants } from "@/lib/cj-catalog";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

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
    const query = z.string().trim().min(2).max(100).safeParse(params.get("q"));
    if (!query.success) throw new AccessError("Enter at least two characters to search CJ.");
    const result = await cjCatalogRequest("listV2", new URLSearchParams({ page: "1", size: "20", keyWord: query.data }));
    return NextResponse.json({ products: cjCatalogProducts(result.data) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
