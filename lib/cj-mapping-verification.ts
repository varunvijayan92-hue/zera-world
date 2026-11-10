type Mapping = { id: string; externalProductId: string | null; supplierVariantId: string | null; supplierSku: string | null; variantId: string | null; mappingStatus: string | null };
type Variant = { id: string; sku: string };
type CjVariant = { vid?: unknown; variantSku?: unknown };

export function verifiedCjMappingIds(productId: string, mappings: Mapping[], variants: Variant[], data: unknown) {
  if (!data || typeof data !== "object") throw new Error("CJ returned invalid product details.");
  const product = data as { pid?: unknown; variants?: unknown };
  if (product.pid !== productId || !Array.isArray(product.variants)) throw new Error("CJ did not return the requested product and variants.");
  const cjVariants = product.variants as CjVariant[];
  return mappings.filter(mapping => {
    if (mapping.mappingStatus !== "PENDING" || mapping.externalProductId !== productId || !mapping.supplierVariantId || !mapping.supplierSku) return false;
    const matches = cjVariants.filter(variant => variant.vid === mapping.supplierVariantId && variant.variantSku === mapping.supplierSku);
    if (matches.length !== 1) return false;
    if (mappings.filter(other => other.externalProductId === productId && other.supplierVariantId === mapping.supplierVariantId).length !== 1) return false;
    if (mapping.variantId) {
      const local = variants.filter(variant => variant.id === mapping.variantId && variant.sku === mapping.supplierSku);
      if (local.length !== 1) return false;
    } else if (variants.length) return false;
    return true;
  }).map(mapping => mapping.id);
}
