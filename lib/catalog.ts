import { prisma } from "./prisma";

export class CatalogError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function resolveProductCategory(categoryId?: string, name?: string) {
  if (categoryId !== undefined) {
    if (!categoryId) return { categoryId: null, category: null };
    const category = await prisma.storeCategory.findUnique({ where: { id: categoryId } });
    if (!category) throw new CatalogError("Select an existing menu category.");
    return { categoryId: category.id, category: category.name };
  }
  if (name !== undefined) {
    const category = name ? await prisma.storeCategory.findFirst({ where: { name: { equals: name, mode: "insensitive" } } }) : null;
    return { categoryId: category?.id || null, category: category?.name || name || null };
  }
  return {};
}
