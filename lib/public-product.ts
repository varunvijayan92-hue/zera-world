type PublicProductInput = {
  id: string; name: string; sku: string; brand: string | null; description: string | null;
  specifications: string | null; manufacturerInfo: string | null; warranty: string | null;
  trend: string | null; inTheBox: string | null; category: string | null; categoryId: string | null;
  imageUrls: string[]; size: string | null; color?: string | null; colorImages?: unknown; deliveryCharge: unknown; sellingPrice: unknown;
  gstRate: unknown; handlingCharge: unknown; returnDays: number; isReturnable: boolean;
};

export function publicProductDetails(product: PublicProductInput) {
  // Browser component props are visible in the page response. Keep this allowlist
  // explicit: supplier identifiers, purchase prices and internal fields stay server-side.
  const colorImages = product.colorImages && typeof product.colorImages === "object" && !Array.isArray(product.colorImages) ? Object.fromEntries(Object.entries(product.colorImages).filter(([key, url]) => (product.color || "").split(",").map(value => value.trim()).includes(key) && typeof url === "string" && product.imageUrls.includes(url))) : {};
  return {
    colorImages, id: product.id, name: product.name, sku: product.sku, brand: product.brand,
    description: product.description, specifications: product.specifications,
    manufacturerInfo: product.manufacturerInfo, warranty: product.warranty,
    trend: product.trend, inTheBox: product.inTheBox, category: product.category,
    categoryId: product.categoryId, imageUrls: product.imageUrls, size: product.size, color: product.color ?? null,
    deliveryCharge: product.deliveryCharge == null ? null : Number(product.deliveryCharge),
    sellingPrice: product.sellingPrice == null ? null : Number(product.sellingPrice),
    gstRate: product.gstRate == null ? null : Number(product.gstRate),
    handlingCharge: product.handlingCharge == null ? null : Number(product.handlingCharge),
    returnDays: product.returnDays, isReturnable: product.isReturnable,
  };
}
