import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { categoryLink } from "@/lib/category";
import { ProductImage } from "@/components/product-image";
export const dynamic = "force-dynamic";
export const metadata = { title: "Categories", description: "Explore the latest Zera's World product categories." };
export default async function CategoriesPage() {
  const categories = await prisma.storeCategory.findMany({ where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <main className="bg-[#F7F4ED] px-5 py-10 text-[#173B35]"><div className="mx-auto max-w-7xl"><h1 className="text-3xl font-black">Categories</h1><p className="mt-3 text-sm text-[#173B35]/70">Find practical products for every part of your day.</p><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{categories.map((category) => <Link key={category.id} href={categoryLink(category.slug)} className="overflow-hidden rounded-3xl border border-[#173B35]/10 bg-white shadow-sm transition hover:shadow-md"><ProductImage src={category.imageUrl} alt={category.name} width={600} height={360} className="h-48 w-full object-cover" /><div className="p-5"><h2 className="text-xl font-bold">{category.name}</h2><p className="mt-2 text-sm text-[#173B35]/65">{category.description || "Explore the collection"}</p></div></Link>)}</div>{!categories.length ? <p className="mt-8 rounded-2xl border bg-white p-6">New categories are on their way. <Link href="/products" className="font-semibold underline">Browse the shop</Link>.</p> : null}</div></main>;
}
