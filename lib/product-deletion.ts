import { prisma } from "./prisma";
import { CatalogError } from "./catalog";

export async function deleteUnusedProduct(id: string, actorId: string) {
  return prisma.$transaction(async tx => {
    const product = await tx.product.findUnique({ where: { id }, select: { id: true, name: true, sku: true } });
    if (!product) throw new CatalogError("Product not found.", 404);
    const [orders, purchases, costs, reservations] = await Promise.all([
      tx.orderItem.count({ where: { productId: id } }),
      tx.purchaseOrderItem.count({ where: { productId: id } }),
      tx.productCost.count({ where: { productId: id } }),
      tx.inventory.count({ where: { productId: id, reservedQty: { gt: 0 } } }),
    ]);
    if (orders || purchases || costs) throw new CatalogError("This product has order or financial history. Use Edit and set its status to Archived instead.", 409);
    if (reservations) throw new CatalogError("This product has reserved stock. Clear its reservations before deleting it.", 409);
    await tx.product.delete({ where: { id } });
    await tx.auditLog.create({ data: { userId: actorId, action: "PRODUCT_DELETED", entityType: "Product", entityId: id, details: { name: product.name, sku: product.sku } } });
    return product.id;
  }, { isolationLevel: "Serializable" });
}
