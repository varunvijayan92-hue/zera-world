import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { buildStoreSitemap } from "@/lib/seo";

export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [categories, products] = await Promise.all([
    getMenuCategories(),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, status: true, updatedAt: true, imageUrls: true }, orderBy: { id: "asc" } }),
  ]);
  return buildStoreSitemap(categories, products);
}
