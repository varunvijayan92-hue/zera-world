type Mapping = { id: string; externalProductId: string | null; supplierVariantId: string | null; packagingSku: string | null };
type Row = { shopId?: unknown; pid?: unknown; vid?: unknown; packSku?: unknown };

export function planCjPackagingSync(mappings: Mapping[], rows: Row[], shopId: string) {
  const updates: { id: string; sku: string; previous: string | null; productId: string | null; variantId: string | null }[] = [];
  let conflicts = 0;
  for (const mapping of mappings) {
    const applicable = rows.filter(row => row.shopId === shopId && row.pid === mapping.externalProductId && row.vid === mapping.supplierVariantId);
    const skus = [...new Set<string>(applicable.flatMap(row => typeof row.packSku === "string" && row.packSku.trim() && row.packSku.length <= 200 ? [row.packSku.trim()] : []))];
    if (skus.length !== 1) { if (skus.length > 1) conflicts++; continue; }
    if (mapping.packagingSku && mapping.packagingSku !== skus[0]) { conflicts++; continue; }
    if (!mapping.packagingSku) updates.push({ id: mapping.id, sku: skus[0], previous: mapping.packagingSku, productId: mapping.externalProductId, variantId: mapping.supplierVariantId });
  }
  return { updates, conflicts };
}
