export function customerReorderProduct(product: { id: string; name: string; sku: string; status: string; sellingPrice: unknown; gstRate: unknown; handlingCharge: unknown; imageUrls: string[]; inventory: { availableQty: number; reservedQty: number }[] } | null | undefined) {
  if (!product) return null;
  const { inventory, ...publicProduct } = product;
  const stock = inventory.reduce((sum, row) => sum + Math.max(0, row.availableQty - row.reservedQty), 0);
  return { ...publicProduct, sellingPrice: Number(product.sellingPrice || 0), gstRate: product.gstRate == null ? null : Number(product.gstRate), handlingCharge: Number(product.handlingCharge || 0), canReorder: product.status === "ACTIVE" && Number(product.sellingPrice) > 0 && stock > 0 };
}
