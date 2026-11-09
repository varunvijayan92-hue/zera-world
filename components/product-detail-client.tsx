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
  specifications?: string | null;
  manufacturerInfo?: string | null;
  warranty?: string | null;
  trend?: string | null;
  inTheBox?: string | null;
  category?: string | null;
  categoryId?: string | null;
  imageUrls: string[];
  size?: string | null;
  color?: string | null;
  deliveryCharge?: number | string | null;
  sellingPrice?: number | string | null;
  gstRate?: number | string | null;
  handlingCharge?: number | string | null;
  returnDays?: number | string | null;
  isReturnable?: boolean | null;
};

function parseSpecificationSections(raw?: string | null): Array<{ title: string; rows: Array<{ key: string; value: string }> }> {
  if (!raw) return [];

  const sections: Array<{ title: string; rows: Array<{ key: string; value: string }> }> = [];
  let current: { title: string; rows: Array<{ key: string; value: string }> } = { title: "", rows: [] };

  const closeCurrent = () => {
    if (current.title || current.rows.length) {
      sections.push(current);
    }
    current = { title: "", rows: [] };
  };

  const splitKeyValue = (line: string) => {
    const separators = [":", " - ", " | ", " – ", " — "];
    for (const separator of separators) {
      const index = line.indexOf(separator);
      if (index > 0 && index < line.length - separator.length) {
        const key = line.slice(0, index).trim();
        const value = line.slice(index + separator.length).trim();
        if (key && value) return { key, value };
      }
    }

    const spaced = line.split(/\s{2,}/);
    if (spaced.length > 1) {
      const [key, ...rest] = spaced;
      const value = rest.join(" ").trim();
      if (key && value) return { key: key.trim(), value };
    }

    return null;
  };

  for (const rawLine of raw.split(/\r?\n|\r/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const parsedRow = splitKeyValue(line);
    if (parsedRow) {
      current.rows.push(parsedRow);
      continue;
    }

    const heading = line.replace(/\s+/g, " ").trim();
    if (!heading) continue;

    if (current.title || current.rows.length) {
      closeCurrent();
    }

    current.title = heading;
  }

  closeCurrent();

  if (!sections.length) {
    return [{ title: "Specifications", rows: raw.split(/\r?\n|\r/).map(line => line.trim()).filter(Boolean).map(line => ({ key: "Details", value: line })) }];
  }

  return sections;
}

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
  const [activeTab, setActiveTab] = useState<"specifications" | "description" | "manufacturer">("specifications");
  const specificationSections = useMemo(() => parseSpecificationSections(product.specifications), [product.specifications]);
  const extraMetadata = [
    product.warranty?.trim() ? { key: "Warranty", value: product.warranty.trim() } : null,
    product.trend?.trim() ? { key: "Trend", value: product.trend.trim() } : null,
    product.inTheBox?.trim() ? { key: "In the box", value: product.inTheBox.trim() } : null,
  ].filter(Boolean) as Array<{ key: string; value: string }>;

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
              <ProductPrice sellingPrice={Number(product.sellingPrice || 0)} gstRate={product.gstRate} handlingCharge={product.handlingCharge} mrp={extras?.mrp} className="" priceClassName="text-3xl font-black tracking-[-0.06em] text-[#173B35]" />
            </div>

            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#173B35]/10 bg-[#F7F4ED] px-2.5 py-1 text-[0.62rem] font-bold uppercase tracking-[0.11em] text-[#173B35]">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#173B35] text-[10px] font-black text-white" aria-hidden="true">✓</span>
              Manufacturer verified product
            </div>

            {product.warranty?.trim() ? <p className="mt-2 text-sm font-medium text-[#173B35]/75">Warranty: {product.warranty.trim()}</p> : null}
            {product.color?.trim() ? <p className="mt-2 text-sm font-medium text-[#173B35]/75">Colour: {product.color.trim()}</p> : null}
            {product.trend?.trim() ? <p className="mt-2 text-sm font-medium text-[#173B35]/75">Trend: {product.trend.trim()}</p> : null}
            {product.inTheBox?.trim() ? <p className="mt-2 text-sm font-medium text-[#173B35]/75">In the box: {product.inTheBox.trim()}</p> : null}

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

            <div className="mt-6">
              <CartButton product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                sellingPrice: Number(product.sellingPrice ?? 0), gstRate: product.gstRate, handlingCharge: product.handlingCharge,
                imageUrls: product.imageUrls,
              }} />
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-[26px] border border-[#173B35]/10 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap gap-3">
            {[
              { id: "specifications", label: "Specifications" },
              { id: "description", label: "Description" },
              { id: "manufacturer", label: "Manufacturer info" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-[14px] border px-5 py-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-[#173B35] bg-[#173B35] text-white" : "border-[#173B35]/15 bg-[#F7F4ED] text-[#173B35] hover:border-[#173B35]/30"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {activeTab === "specifications" ? (
              <div className="space-y-8">
                {extraMetadata.length ? (
                  <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
                    <h3 className="mb-4 text-xl font-bold text-[#173B35]">Product details</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {extraMetadata.map((row) => (
                        <div key={row.key} className="border-b border-[#173B35]/12 pb-3 text-sm">
                          <div className="text-[#173B35]/70">{row.key}</div>
                          <div className="mt-1 text-[#173B35]">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {specificationSections.length ? (
                  specificationSections.map((section) => (
                    <div key={section.title || section.rows[0]?.key || "section"}>
                      {section.title ? <h3 className="mb-4 text-xl font-bold text-[#173B35]">{section.title}</h3> : null}
                      {section.rows.length ? (
                        <div className="grid gap-3 md:grid-cols-2">
                          {section.rows.map((row) => (
                            <div key={`${section.title}-${row.key}-${row.value}`} className="border-b border-[#173B35]/12 pb-3 text-sm">
                              <div className="text-[#173B35]/70">{row.key}</div>
                              <div className="mt-1 text-[#173B35]">{row.value}</div>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#173B35]/65">No detailed specifications have been added for this product yet.</p>
                )}
              </div>
            ) : null}

            {activeTab === "description" ? (
              <div className="space-y-4 text-sm leading-7 text-[#173B35]/75">
                {product.description?.trim() ? <p>{product.description.trim()}</p> : <p>No long description has been added for this product.</p>}
              </div>
            ) : null}

            {activeTab === "manufacturer" ? (
              <div className="space-y-4 text-sm leading-7 text-[#173B35]/75">
                {product.manufacturerInfo?.trim() ? <p>{product.manufacturerInfo.trim()}</p> : <p>No manufacturer information has been added for this product.</p>}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
