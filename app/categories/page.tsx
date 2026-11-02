import { publicPageMetadata } from "@/lib/seo";
import Link from "next/link";
import { getMenuCategories } from "@/lib/category-data";
import { categoryLink, visibleMenuCategories } from "@/lib/category";
import { ProductImage } from "@/components/product-image";
export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("Categories","Explore Zera's World categories and subcategories.","/categories");
export default async function CategoriesPage() {
  const categories = visibleMenuCategories(await getMenuCategories());
  const roots = categories.filter(category => !category.parentId);
  return <main className="bg-[#F7F4ED] px-5 py-10 text-[#173B35]"><div className="mx-auto max-w-7xl"><h1 className="text-3xl font-black">Categories</h1><p className="mt-3 text-sm text-[#173B35]/70">Find practical products for every part of your day.</p><div className="mt-8 space-y-8">{roots.map(category => <section key={category.id} className="rounded-3xl border border-[#173B35]/10 bg-white p-5"><Link href={categoryLink(category.slug)} className="flex flex-col gap-5 sm:flex-row sm:items-center"><ProductImage src={category.imageUrl} alt={category.name} width={600} height={360} className="h-40 w-full rounded-2xl object-cover sm:w-64" /><div><h2 className="text-2xl font-bold">{category.name}</h2><p className="mt-2 text-sm text-[#173B35]/65">{category.description || "Explore the collection"}</p><p className="mt-3 text-sm underline">Shop all {category.name}</p></div></Link><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{categories.filter(child => child.parentId === category.id).map(child => <Link key={child.id} href={categoryLink(child.slug)} className="overflow-hidden rounded-2xl border"><ProductImage src={child.imageUrl} alt={child.name} width={400} height={240} className="h-32 w-full object-cover" /><div className="p-4"><h3 className="font-bold">{child.name}</h3>{child.description ? <p className="mt-1 text-xs">{child.description}</p> : null}</div></Link>)}</div></section>)}</div>{!roots.length ? <p className="mt-8 rounded-2xl border bg-white p-6">New categories are on their way. <Link href="/products" className="font-semibold underline">Browse the shop</Link>.</p> : null}</div></main>;
}
