import { NextResponse } from "next/server";
import { portalUser, apiError } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { MAX_PRODUCT_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/product-photos";

export async function GET(request: Request) {
  try {
    await portalUser("ADMIN", request);
    const [categories, suppliers] = await Promise.all([
      getMenuCategories(),
      prisma.supplier.findMany({ select: { id: true, companyName: true, status: true, sourceType: true, provider: true }, orderBy: { companyName: "asc" } }),
    ]);
    return NextResponse.json({ data: { categories, suppliers, statuses: ["DRAFT", "ACTIVE", "ARCHIVED"], currency: "INR", photos: { maxCount: MAX_PRODUCT_PHOTOS, maxBytes: MAX_PHOTO_BYTES, mimeTypes: ["image/jpeg", "image/png", "image/webp"] } } });
  } catch (error) { return apiError(error); }
}
