"use client";

import { ProductGallery } from "@/components/product-gallery";
import { CartButton } from "@/components/cart-button";
import { ProductPrice } from "@/components/product-price";
import { categoryLink } from "@/lib/category";
import { ArrowLeft, Check, Truck } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

type CategoryLike = { id: string; slug: string; name: string; parentId?: string | null };

type ProductDetailRecord = {
  id: string;
  name: string;
  sku: string;
  brand?: string | null;
  description?: string | null;
  category?: string | null;
  categoryId?: string | null;
  imageUrls: string[];
  size?: string | null;
  sellingPrice?: number | string | null;
  gstRate?: number | string | null;
  handlingCharge?: number | string | null;
  returnDays?: number | string | null;
  isReturnable?: boolean | null;
};

export function ProductDetailClient({ product, assignedCategory, parentCategory, categoryLabel, extras, detailBits }: {
  product: ProductDetailRecord;
  assignedCategory?: CategoryLike;
  parentCategory?: CategoryLike;
  categoryLabel: string;
  extras?: { mrp: number | null; hsnCode: string | null };
  detailBits: string[];
}) {
  const sizeOptions = useMemo(() => product.size ? product.size.split(",").map(size => size.trim()).filter(Boolean) : [], [product.size]);
  const [selectedSize, setSelectedSize] = useState(sizeOptions[0] ?? "");

  return (
    <main className="min-h-screen bg-[#f4f1eb] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/products" className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
          <ArrowLeft size={16} />
          Back to products
        </Link>

        <div className="grid gap-8 overflow-hidden rounded-[30px] border border-[#173B35]/10 bg-white p-5 shadow-[0_18px_48px_rgba(23,59,53,0.06)] lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div className="rounded-[26px] bg-[#f7f4ee] p-3">
            <ProductGallery images={product.imageUrls} name={product.name} />
          </div>

          <div className="rounded-[26px] border border-[#173B35]/10 bg-white p-3 sm:p-5">
            {assignedCategory ? <nav aria-label="Product category" className="flex flex-wrap gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-[#173B35]/60">{parentCategory ? <><Link href={categoryLink(parentCategory.slug)}>{parentCategory.name}</Link><span aria-hidden="true">/</span></> : null}<Link href={categoryLink(assignedCategory.slug)}>{assignedCategory.name}</Link></nav> : categoryLabel ? <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#173B35]/60">{categoryLabel}</p> : null}

            <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.08em] text-[#173B35] sm:text-4xl">{product.name}</h1>
            {product.brand?.trim() ? <p className="mt-2 text-sm text-[#173B35]/70">Brand: {product.brand}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-[#173B35]/70">
              <span className="rounded-full bg-[#B38A45]/10 px-2.5 py-1 font-medium text-[#173B35]">SKU: {product.sku}</span>
              {extras?.hsnCode ? <span className="rounded-full bg-[#F7F4ED] px-2.5 py-1">HSN: {extras.hsnCode}</span> : null}
            </div>

            <div className="mt-5">
              <ProductPrice sellingPrice={Number(product.sellingPrice || 0)} mrp={extras?.mrp} className="" priceClassName="text-3xl font-black tracking-[-0.06em] text-[#173B35]" />
            </div>

            {sizeOptions.length ? (
              <div className="mt-6">
                <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#173B35]/70">Select Size</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {sizeOptions.map((size) => {
                    const isSelected = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setSelectedSize(size)}
                        className={`min-w-[52px] rounded-xl border px-3 py-2 text-sm font-semibold transition ${isSelected ? "border-[#173B35] bg-[#173B35] text-white shadow-sm" : "border-[#173B35]/15 bg-[#F7F4ED] text-[#173B35] hover:border-[#173B35]/35"}`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm text-[#173B35]/70">
                  <Check size={16} className="text-[#173B35]" />
                  <span>{selectedSize ? `Selected size: ${selectedSize}` : "Choose a size to continue."}</span>
                </div>
              </div>
            ) : null}

            <div className="mt-6 space-y-3 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4 text-sm text-[#173B35]/75">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#173B35]" />
                <span>Fast dispatch and marketplace-ready shipping</span>
              </div>
              {detailBits.length ? <p>{detailBits.join(" • ")}</p> : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <CartButton product={{
                  id: product.id,
                  name: product.name,
                  sku: product.sku,
                  sellingPrice: Number(product.sellingPrice ?? 0),
                  imageUrls: product.imageUrls,
                }} />
              </div>
              <button type="button" className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(23,59,53,0.20)] transition hover:bg-[#0f2a26]">
                Buy at ₹{Number(product.sellingPrice ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
              </button>
            </div>

            {product.description?.trim() ? <div className="mt-8 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4 text-sm text-[#173B35]/75">
              <p className="font-semibold text-[#173B35]">Product overview</p>
              <p className="mt-2 leading-6">{product.description.trim()}</p>
            </div> : null}
          </div>
        </div>
      </div>
    </main>
  );
}
