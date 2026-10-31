import { CategoryMenu } from "@/components/category-menu";
import { ProductImage } from "@/components/product-image";
import { CartButton } from "@/components/cart-button";
import Link from "next/link";
import { ShoppingBag, Truck } from "lucide-react";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; category?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const query = (params.q || "").trim();
  const categoryFilter = (params.category || "all").trim();

  const menuCategories = await prisma.storeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  const selectedCategory = menuCategories.find((category) => category.slug === categoryFilter || category.name.toLowerCase() === categoryFilter.toLowerCase());
  const visibleCategories = menuCategories.filter((category) => category.isVisible);
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
        ? selectedCategory ? { categoryId: selectedCategory.id } : { category: { equals: categoryFilter, mode: "insensitive" } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: { supplier: true },
  });

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 overflow-hidden rounded-2xl bg-[#173B35] pb-4"><CategoryMenu categories={visibleCategories} selected={selectedValue} /></div>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Catalogue</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.07em]">{selectedCategory?.name || "Products"}</h1>
            {selectedCategory?.description ? <p className="mt-3 max-w-2xl text-sm text-[#173B35]/70">{selectedCategory.description}</p> : null}
          </div>
          <Link href="/" className="inline-flex rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
            Back to home
          </Link>
        </div>

        <div className="mb-8 rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_18px_42px_rgba(23,59,53,0.06)]">
          <form method="get" className="flex flex-col gap-4 md:flex-row md:items-end">
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
                {visibleCategories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
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
                      <ProductImage src={imageUrl} alt={product.name} width={600} height={600} sizes="(min-width: 1280px) 25vw, (min-width: 768px) 50vw, 100vw" className="h-full w-full object-cover" />
                    </div>
                  </Link>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-[#173B35]/60">
                        {product.category || "Featured"}
                      </p>
                      <Link href={`/products/${product.id}`} className="mt-2 block text-lg font-bold text-[#173B35] hover:text-[#0f2a26]">
                        {product.name}
                      </Link>
                    </div>
                    <Link href={`/products/${product.id}`} className="rounded-full bg-[#173B35] p-2 text-white" aria-label={`View ${product.name}`}>
                      <ShoppingBag size={16} />
                    </Link>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xl font-black text-[#173B35]">₹{Number(product.sellingPrice ?? 0).toLocaleString("en-IN")}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#B38A45]/10 px-2 py-1 text-[0.7rem] font-medium text-[#173B35]">
                      <Truck size={12} />
                      Ready to ship
                    </span>
                  </div>
                  <div className="mt-4"><CartButton product={{ id: product.id, name: product.name, sku: product.sku, sellingPrice: Number(product.sellingPrice), imageUrls: product.imageUrls }} /></div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
