type Mapping = { supplierVariantKey: string | null; supplierVariantId: string | null; supplierSku: string | null; mappingStatus: string | null };

const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim();

/** Match both customer choices to the exact CJ option key; ambiguity fails closed. */
export function matchCjVariant<T extends Mapping>(mappings: T[], color?: string | null, size?: string | null): T | null {
  const parts = [color?.trim(), size?.trim()].filter((value): value is string => Boolean(value));
  if (!parts.length) return null;
  const candidate = normalize(parts.join("-"));
  const matches = mappings.filter(row => row.mappingStatus === "ACTIVE" && row.supplierVariantId && row.supplierSku && row.supplierVariantKey && normalize(row.supplierVariantKey) === candidate);
  return matches.length === 1 ? matches[0] : null;
}
