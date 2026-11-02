import type { Prisma } from "@prisma/client";
import { AccessError } from "./portal-access";

type StockUpdate = { productId: string; stock: number; costPrice: number; hsnCode?: string | null };

export async function updateSupplierCatalog(tx: Prisma.TransactionClient, supplierId: string, input: StockUpdate) {
  const product = await tx.product.findFirst({ where: { id: input.productId, supplierId }, select: { id: true, sku: true } });
  if (!product) throw new AccessError("Product not found.", 404);
  const rows = await tx.inventory.findMany({ where: { productId: product.id, warehouseId: null, OR: [{ supplierId }, { supplierId: null }] } });
  const owned = rows.filter(row => row.supplierId === supplierId);
  const opening = rows.filter(row => row.supplierId === null);
  if (owned.length > 1 || (!owned.length && opening.length > 1) || (owned.length && opening.some(row => row.availableQty || row.reservedQty || row.damagedQty || row.incomingQty))) {
    throw new AccessError("Multiple default stock records require admin review before supplier stock can be updated.", 409);
  }
  const row = owned[0] || opening[0];
  if (row && row.status !== "AVAILABLE") throw new AccessError("This stock record requires an admin adjustment before supplier updates.", 409);
  if (row && input.stock < row.reservedQty) throw new AccessError("Stock cannot be lower than reserved quantity.");
  // Adopt a single opening-stock row, rather than adding the same stock twice.
  if (row) await tx.inventory.update({ where: { id: row.id }, data: { supplierId, availableQty: input.stock, lastUpdatedAt: new Date() } });
  else await tx.inventory.create({ data: { productId: product.id, supplierId, availableQty: input.stock } });
  await tx.product.update({ where: { id: product.id }, data: { costPrice: input.costPrice, ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode } : {}) } });
  await tx.supplierProduct.upsert({ where: { supplierId_supplierProductCode: { supplierId, supplierProductCode: product.sku } }, create: { supplierId, productId: product.id, supplierProductCode: product.sku, purchasePrice: input.costPrice }, update: { productId: product.id, purchasePrice: input.costPrice, lastUpdatedAt: new Date() } });
}
