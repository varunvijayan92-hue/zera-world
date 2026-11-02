import { z } from "zod";

export function categorySlug(name: string) {
  return name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
}

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(80),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens for the slug.").refine((value) => value !== "all", "Choose a slug other than all."),
  description: z.string().trim().max(500).default(""),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isVisible: z.boolean().default(true),
  parentId: z.string().trim().min(1).nullable().optional(),
});

export type MenuCategory = { parentId?: string | null; imageUrl?: string | null; imagePublicId?: string | null; id: string; name: string; slug: string; description: string; sortOrder: number; isVisible: boolean };

export function categoryDisplayName(category: MenuCategory, categories: MenuCategory[]) {
  const parent = categories.find(entry => entry.id === category.parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}
export function visibleMenuCategories<T extends MenuCategory>(categories: T[]) {
  return categories.filter(category => category.isVisible && (!category.parentId || categories.some(parent => parent.id === category.parentId && parent.isVisible && !parent.parentId)));
}
export function categoryProductIds(category: MenuCategory, categories: MenuCategory[]) {
  return [category.id, ...categories.filter(entry => entry.parentId === category.id).map(entry => entry.id)];
}
export function categoryParentError(categories: MenuCategory[], id: string | undefined, parentId: string | null) {
  if (!parentId) return null;
  if (id === parentId) return "A category cannot be its own parent.";
  const parent = categories.find(entry => entry.id === parentId);
  if (!parent) return "Choose an existing parent category.";
  if (parent.parentId) return "Choose a main category as the parent, rather than a subcategory.";
  if (id && categories.some(entry => entry.parentId === id)) return "Move this category's subcategories before making it a subcategory.";
  return null;
}

export function categoryLink(slug: string) {
  return `/products?category=${encodeURIComponent(slug)}`;
}

export function nextCategoryPosition(categories: Pick<MenuCategory, "sortOrder">[]) {
  return Math.max(-1, ...categories.map((category) => category.sortOrder)) + 1;
}
