import { CategoryMenu } from "@/components/category-menu";
import { ProductImage } from "@/components/product-image";
import { CartButton } from "@/components/cart-button";
import Link from "next/link";
import { ShoppingBag, Truck } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { categoryDisplayName, categoryProductIds, categoryLink, visibleMenuCategories } from "@/lib/category";
import type { Metadata } from "next";
import { publicPageMetadata } from "@/lib/seo";
import { readProductExtras } from "@/lib/product-pricing";
import { ProductPrice } from "@/components/product-price";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string; sort?: string }> }): Promise<Metadata> {
  const params = searchParams ? await searchParams : {};
  const categories = await getMenuCategories();
  const selected = categories.find(category => category.slug === params.category || category.name.toLowerCase() === params.category?.toLowerCase());
  const path = selected ? categoryLink(selected.slug) : params.sort === "newest" ? "/new-arrivals" : "/products";
  const title = selected ? categoryDisplayName(selected, categories) : "Shop";
  const description = selected?.description || `Shop ${selected?.name || "home, kitchen, travel and lifestyle essentials"} at Zera's World.`;
  return { ...publicPageMetadata(title, description, path), ...(params.q?.trim() || (params.category && params.category !== "all" && !selected) ? { robots: { index: false, follow: true } } : {}) };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const isNewArrivals = params.sort === "newest";
  const query = (params.q || "").trim();
  const categoryFilter = (params.category || "all").trim();

  const menuCategories = await getMenuCategories();
  const selectedCategory = menuCategories.find((category) => category.slug === categoryFilter || category.name.toLowerCase() === categoryFilter.toLowerCase());
  const visibleCategories = visibleMenuCategories(menuCategories);
  const subcategories = selectedCategory ? visibleCategories.filter(category => category.parentId === selectedCategory.id) : [];
  const parentCategory = menuCategories.find(category => category.id === selectedCategory?.parentId);
  const selectedValue = selectedCategory?.slug || categoryFilter;
  const products = await prisma.product.findMany({
    where: {
      status: "ACTIVE",
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { sku: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(categoryFilter && categoryFilter !== "all"
        ? selectedCategory ? { categoryId: { in: categoryProductIds(selectedCategory, menuCategories) } } : { category: { equals: categoryFilter, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  const extras = await readProductExtras(products.map(product => product.id));

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-2xl bg-[#173B35] pb-4"><CategoryMenu categories={visibleCategories} selected={selectedValue} /></div>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Catalogue</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.07em]">{isNewArrivals ? "New Arrivals" : selectedCategory?.name || "Products"}</h1>
            {parentCategory ? <Link href={categoryLink(parentCategory.slug)} className="mt-3 inline-block text-sm underline">Back to {parentCategory.name}</Link> : null}
            {selectedCategory?.description ? <p className="mt-3 max-w-2xl text-sm text-[#173B35]/70">{selectedCategory.description}</p> : null}
          </div>
          <Link href="/" className="inline-flex rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
            Back to home
          </Link>
        </div>

        {subcategories.length ? <section aria-label="Subcategories" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{subcategories.map(category => <Link key={category.id} href={categoryLink(category.slug)} className="overflow-hidden rounded-2xl border bg-white"><ProductImage src={category.imageUrl} alt={category.name} width={400} height={240} className="h-32 w-full object-cover" /><h2 className="p-4 font-bold">{category.name}</h2></Link>)}</section> : null}
        <div className="mb-8 rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_18px_42px_rgba(23,59,53,0.06)]">
          <form id="catalog-search" method="get" className="flex flex-col gap-4 md:flex-row md:items-end">
            {isNewArrivals ? <input type="hidden" name="sort" value="newest" /> : null}
            <div className="flex-1">
              <label className="mb-2 block text-sm font-medium text-[#173B35]">Search</label>
              <input
                name="q"
                defaultValue={query}
                className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-sm text-[#173B35] outline-none focus:border-[#173B35]"
                placeholder="Search by product name, SKU, or keyword"
              />
            </div>

            <div className="md:w-64">
              <label className="mb-2 block text-sm font-medium text-[#173B35]">Category</label>
              <select
                name="category"
                defaultValue={selectedValue}
                className="w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-3 text-sm text-[#173B35] outline-none focus:border-[#173B35]"
              >
                <option value="all">All categories</option>
                {visibleCategories.map((category) => <option key={category.id} value={category.slug}>{categoryDisplayName(category, menuCategories)}</option>)}
                {selectedValue !== "all" && !visibleCategories.some((category) => category.slug === selectedValue) ? <option value={selectedValue}>{selectedCategory?.name || categoryFilter}</option> : null}
              </select>
            </div>

            <button type="submit" className="rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">
              Apply filters
            </button>
          </form>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full rounded-[28px] border border-dashed border-[#173B35]/20 bg-white p-10 text-center">
              <p className="text-lg font-semibold">No products found</p>
              <p className="mt-2 text-sm text-[#173B35]/70">Try a different keyword or reset the filter.</p>
            </div>
          ) : (
            products.map((product) => {
              const imageUrl = product.imageUrls?.[0] || "";

              return (
                <article key={product.id} className="overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-white p-4 shadow-[0_14px_32px_rgba(23,59,53,0.05)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(23,59,53,0.08)]">
                  <Link href={`/products/${product.id}`} className="block">
                    <div className="flex h-52 items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-br from-[#8EA695]/30 via-[#F7F4ED] to-[#B38A45]/20 text-4xl text-[#173B35]">
                      <ProductImage src={imageUrl} alt={product.name} fit="contain" width={600} height={600} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" className="h-full w-full bg-[#F7F4ED] object-contain p-2" />
                    </div>
                  </Link>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      {product.category ? (
                        <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[#173B35]/60">
                          {product.category}
                        </p>
                      ) : null}
                      <Link href={`/products/${product.id}`} className="mt-2 block text-lg font-bold text-[#173B35] hover:text-[#0f2a26]">
                        {product.name}
                      </Link>
                      {product.size?.trim() ? <p className="mt-2 text-xs font-medium text-[#173B35]/70">Size: {product.size.trim()}</p> : null}
                    </div>
                    <Link href={`/products/${product.id}`} className="rounded-full bg-[#173B35] p-2 text-white" aria-label={`View ${product.name}`}>
                      <ShoppingBag size={16} />
                    </Link>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <ProductPrice sellingPrice={Number(product.sellingPrice || 0)} gstRate={product.gstRate == null ? null : Number(product.gstRate)} handlingCharge={Number(product.handlingCharge || 0)} mrp={extras.get(product.id)?.mrp} priceClassName="text-xl font-black text-[#173B35]" />
                    <Link href={`/products/${product.id}`} className="inline-flex items-center gap-1 rounded-full bg-[#B38A45]/10 px-2 py-1 text-[0.7rem] font-medium text-[#173B35]">
                      <Truck size={12} />
                      Buy now
                    </Link>
                  </div>
                  <div className="mt-4"><CartButton product={{ id: product.id, name: product.name, sku: product.sku, sellingPrice: Number(product.sellingPrice), gstRate: product.gstRate == null ? null : Number(product.gstRate), handlingCharge: Number(product.handlingCharge || 0), imageUrls: product.imageUrls, requiresOptions: Boolean(product.color?.trim() || product.size?.trim()) }} /></div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
