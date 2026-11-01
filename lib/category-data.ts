import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { categoryParentError, type MenuCategory } from "./category";
import type { z } from "zod";
import type { categorySchema } from "./category";

// Explicit SQL also supports a running local server before its generated client is refreshed.
export async function getMenuCategories(db: Prisma.TransactionClient = prisma) {
  return db.$queryRaw<MenuCategory[]>`SELECT * FROM "StoreCategory" ORDER BY "sortOrder" ASC, "name" ASC`;
}
export async function getMenuCategory(id: string, db: Prisma.TransactionClient = prisma) {
  return (await db.$queryRaw<MenuCategory[]>`SELECT * FROM "StoreCategory" WHERE "id" = ${id}`)[0] || null;
}
export class CategoryError extends Error { constructor(message: string, public status = 400) { super(message); } }
export async function saveMenuCategory(input: Partial<z.infer<typeof categorySchema>>, id?: string) {
  return prisma.$transaction(async tx => {
    const categories = await getMenuCategories(tx);
    const current = id ? categories.find(entry => entry.id === id) : undefined;
    if (id && !current) throw new CategoryError("Category not found.", 404);
    const parentId = input.parentId === undefined ? current?.parentId || null : input.parentId;
    const error = categoryParentError(categories, id, parentId);
    if (error) throw new CategoryError(error);
    const { parentId: ignoredParent, ...fields } = input;
    void ignoredParent;
    const saved = id
      ? await tx.storeCategory.update({ where: { id }, data: fields })
      : await tx.storeCategory.create({ data: { name: input.name!, slug: input.slug!, ...fields } });
    await tx.$executeRaw`UPDATE "StoreCategory" SET "parentId" = ${parentId} WHERE "id" = ${saved.id}`;
    if (current && saved.name !== current.name) await tx.product.updateMany({ where: { categoryId: saved.id }, data: { category: saved.name } });
    return { ...saved, parentId };
  }, { isolationLevel: "Serializable" });
}
export async function deleteMenuCategory(id: string) {
  return prisma.$transaction(async tx => {
    const category = await getMenuCategory(id, tx);
    if (!category) throw new CategoryError("Category not found.", 404);
    const children = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "StoreCategory" WHERE "parentId" = ${id} LIMIT 1`;
    if (children.length) throw new CategoryError("Move or delete its subcategories before deleting this category.", 409);
    if (await tx.product.count({ where: { categoryId: id } })) throw new CategoryError("Move its products before deleting this category.", 409);
    await tx.storeCategory.delete({ where: { id } });
  }, { isolationLevel: "Serializable" });
}
