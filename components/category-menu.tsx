import Link from "next/link";
import { categoryLink, type MenuCategory } from "@/lib/category";
type CategoryOption = Pick<MenuCategory, "id" | "name" | "slug" | "parentId">;
export function CategoryMenu({ categories, selected }: { categories: CategoryOption[]; selected?: string }) {
  if (!categories.length) return null;
  return <nav className="tokoo-subnav flex-wrap" aria-label="Product categories">{categories.filter(category => !category.parentId).map(category => {
    const children = categories.filter(child => child.parentId === category.id);
    return <div key={category.id}><Link href={categoryLink(category.slug)} className="tokoo-subnav-item inline-block" aria-current={selected === category.slug ? "page" : undefined}>{category.name}</Link>{children.length ? <details open={children.some(child => child.slug === selected)} className="mt-2 text-white"><summary className="cursor-pointer px-3 py-1 text-xs">{category.name} subcategories</summary><ul className="space-y-2 p-3">{children.map(child => <li key={child.id}><Link href={categoryLink(child.slug)} aria-current={selected === child.slug ? "page" : undefined} className="text-sm underline">{child.name}</Link></li>)}</ul></details> : null}</div>;
  })}</nav>;
}
