import { publicProductDetails } from "@/lib/public-product";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/product-detail-client";

import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { cache } from "react";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";
import { readProductExtras } from "@/lib/product-pricing";

export const dynamic = "force-dynamic";
const getProduct = cache((id: string) => prisma.product.findUnique({ where: { id } }));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product || product.status !== "ACTIVE") return { title: "Product not found", robots: { index: false, follow: false } };
  const metadata = publicPageMetadata(product.name, product.description?.trim().slice(0, 160) || `Discover ${product.name} at Zera's World. View product details and shop online.`, `/products/${encodeURIComponent(id)}`);
  return { ...metadata, openGraph: { ...metadata.openGraph, ...(product.imageUrls.length ? { images: product.imageUrls.map(url => ({ url, alt: product.name })) } : {}) } };
}

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product || product.status !== "ACTIVE") {
    notFound();
  }

  const categoryLabel = (product.category || "").trim();
  const categories = product.categoryId ? await getMenuCategories() : [];
  const assignedCategory = categories.find(category => category.id === product.categoryId);
  const parentCategory = categories.find(category => category.id === assignedCategory?.parentId);
  const extras = (await readProductExtras([id])).get(id);
  const detailBits: string[] = [];
  if (product.isReturnable && Number(product.returnDays ?? 0) > 0) detailBits.push(`Returns within ${product.returnDays} days after delivery.`);
  else if (!product.isReturnable) detailBits.push("This product cannot be returned.");

  const clientProduct = publicProductDetails(product);

  return <ProductDetailClient product={clientProduct} assignedCategory={assignedCategory} parentCategory={parentCategory} categoryLabel={categoryLabel} extras={extras} detailBits={detailBits} />;
}
