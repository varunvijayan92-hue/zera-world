import Link from "next/link";
import { categoryLink, type MenuCategory } from "@/lib/category";

export function CategoryMenu({ categories, selected }: { categories: Pick<MenuCategory, "id" | "name" | "slug">[]; selected?: string }) {
  if (!categories.length) return null;
  return <nav className="tokoo-subnav" aria-label="Product categories">
    {categories.map((category) => <Link key={category.id} href={categoryLink(category.slug)} className="tokoo-subnav-item max-w-full break-words text-center" aria-current={selected === category.slug ? "page" : undefined}>{category.name}</Link>)}
  </nav>;
}
