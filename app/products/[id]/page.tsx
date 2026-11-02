import { ProductGallery } from "@/components/product-gallery";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShoppingBag, Truck } from "lucide-react";

import { CartButton } from "@/components/cart-button";
import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { categoryLink } from "@/lib/category";
import { cache } from "react";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";
const getProduct = cache((id: string) => prisma.product.findUnique({ where: { id }, include: { supplier: true } }));

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
  const description = product.description?.trim();
  const gstValue = Number(product.gstRate ?? 0);
  const handlingValue = Number(product.handlingCharge ?? 0);
  const detailBits: string[] = [];
  if (gstValue > 0) detailBits.push(`GST: ${gstValue}%`);
  if (handlingValue > 0) detailBits.push(`Handling: INR ${handlingValue.toFixed(2)} per unit`);
  if (product.isReturnable && Number(product.returnDays ?? 0) > 0) detailBits.push(`Returns within ${product.returnDays} days after delivery.`);
  else if (!product.isReturnable) detailBits.push("This product cannot be returned.");

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/products" className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
          <ArrowLeft size={16} />
          Back to products
        </Link>

        <div className="grid gap-8 rounded-[32px] border border-[#173B35]/10 bg-white p-5 shadow-[0_18px_48px_rgba(23,59,53,0.06)] lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <ProductGallery images={product.imageUrls} name={product.name} />

          <div>
            {assignedCategory ? <nav aria-label="Product category" className="flex flex-wrap gap-2 text-xs font-semibold text-[#173B35]/60">{parentCategory ? <><Link href={categoryLink(parentCategory.slug)}>{parentCategory.name}</Link><span aria-hidden="true">/</span></> : null}<Link href={categoryLink(assignedCategory.slug)}>{assignedCategory.name}</Link></nav> : categoryLabel ? <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#173B35]/60">{categoryLabel}</p> : null}
            <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.07em] text-[#173B35] sm:text-4xl">{product.name}</h1>
            {product.brand?.trim() ? <p className="mt-3 text-sm">Brand: {product.brand}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 break-all text-sm text-[#173B35]/70">
              <span className="rounded-full bg-[#B38A45]/10 px-2.5 py-1 font-medium text-[#173B35]">SKU: {product.sku}</span>
              {product.supplier ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                <ShieldCheck size={14} />
                Verified supplier
              </span> : null}
            </div>

            <p className="mt-5 text-3xl font-black text-[#173B35]">₹{Number(product.sellingPrice ?? 0).toLocaleString("en-IN")}</p>

            <div className="mt-6 space-y-3 text-sm text-[#173B35]/75">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#173B35]" />
                <span>Fast dispatch and marketplace-ready shipping</span>
              </div>
              {product.supplier?.companyName?.trim() ? <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-[#173B35]" />
                <span>Supplier: {product.supplier.companyName}</span>
              </div> : null}
            </div>

            {detailBits.length ? <p className="mt-4 text-sm">{detailBits.join(" • ")}</p> : null}
            <div className="mt-6">
              <CartButton product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                sellingPrice: Number(product.sellingPrice ?? 0),
                imageUrls: product.imageUrls,
              }} />
            </div>

            {description ? <div className="mt-8 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4 text-sm text-[#173B35]/75">
              <p className="font-semibold text-[#173B35]">Product overview</p>
              <p className="mt-2 leading-6">
                {description}
              </p>
            </div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
