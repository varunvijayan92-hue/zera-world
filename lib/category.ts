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
});

export type MenuCategory = { id: string; name: string; slug: string; description: string; sortOrder: number; isVisible: boolean };

export function categoryLink(slug: string) {
  return `/products?category=${encodeURIComponent(slug)}`;
}

export function nextCategoryPosition(categories: Pick<MenuCategory, "sortOrder">[]) {
  return Math.max(-1, ...categories.map((category) => category.sortOrder)) + 1;
}
