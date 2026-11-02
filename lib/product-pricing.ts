import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { CatalogError } from "./catalog";

export type ProductExtra = { mrp: number | null; hsnCode: string | null };
export async function readProductExtras(ids: string[], db: Prisma.TransactionClient = prisma) {
  if (!ids.length) return new Map<string, ProductExtra>();
  const rows = await db.$queryRaw<{ id: string; mrp: unknown; hsnCode: string | null }[]>(Prisma.sql`SELECT "id", "mrp", "hsnCode" FROM "Product" WHERE "id" IN (${Prisma.join(ids)})`);
  return new Map(rows.map(row => [row.id, { mrp: row.mrp == null ? null : Number(row.mrp), hsnCode: row.hsnCode }]));
}
export function validateMrp(mrp: number | null, sellingPrice: unknown) {
  if (mrp != null && (!Number.isFinite(mrp) || mrp <= 0 || mrp < Number(sellingPrice || 0))) throw new CatalogError("MRP must be at least the selling price.");
}
export async function saveProductExtras(db: Prisma.TransactionClient, id: string, input: { mrp?: number | null; hsnCode?: string | null }, sellingPrice: unknown) {
  const current = (await readProductExtras([id], db)).get(id) || { mrp: null, hsnCode: null };
  const extra = { mrp: input.mrp === undefined ? current.mrp : input.mrp, hsnCode: input.hsnCode === undefined ? current.hsnCode : input.hsnCode };
  validateMrp(extra.mrp, sellingPrice);
  if (input.mrp !== undefined || input.hsnCode !== undefined) await db.$executeRaw`UPDATE "Product" SET "mrp" = ${extra.mrp}::numeric, "hsnCode" = ${extra.hsnCode}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${id}`;
  return extra;
}
