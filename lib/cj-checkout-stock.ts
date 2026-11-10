import { prisma } from "./prisma";
import { matchCjVariant } from "./cj-variant-match";
import { refreshCjVariantStock } from "./cj-variant-stock";

type Item = { productId: string; quantity: number; selectedColor?: string; selectedSize?: string };
/** Fetch current CJ stock before checkout. Unknown, incomplete, and ambiguous matches fail closed. */
export async function cjCheckoutStock(cart: Item[], forceRefresh: boolean) {
  const products = await prisma.product.findMany({ where: { id: { in: cart.map(item => item.productId) }, supplier: { provider: "CJ_DROPSHIPPING" } }, select: { id: true, supplierId: true, supplier: { select: { status: true } }, supplierProductMappings: true } });
  const result = new Map<string, number>();
  const selected = new Map<string, string>();
  for (const product of products) {
    const item = cart.find(value => value.productId === product.id)!;
    if (product.supplier?.status !== "ACTIVE") throw new Error("One or more supplier products are unavailable.");
    let matches = product.supplierProductMappings.filter(row => row.supplierId === product.supplierId);
    let mapping = matchCjVariant(matches, item.selectedColor, item.selectedSize);
    if (!mapping?.externalProductId || !mapping.id) throw new Error("One or more selected product options are unavailable. Please choose another colour and size.");
    if (forceRefresh || !mapping.lastStockCheckAt || Date.now() - mapping.lastStockCheckAt.getTime() > 60000) {
      try { await refreshCjVariantStock(product.id, mapping.externalProductId); }
      catch { throw new Error("One or more supplier stock checks are temporarily unavailable. Please try again."); }
      matches = await prisma.supplierProductMapping.findMany({ where: { productId: product.id, supplierId: product.supplierId! } });
      mapping = matchCjVariant(matches, item.selectedColor, item.selectedSize);
    }
    if (!mapping || mapping.supplierStockQty === null || !mapping.lastStockCheckAt || Date.now() - mapping.lastStockCheckAt.getTime() > 60000) throw new Error("One or more supplier stock checks are temporarily unavailable. Please try again.");
    result.set(product.id, mapping.supplierStockQty);
    selected.set(product.id, mapping.id);
  }
  return { stock: result, selected };
}
