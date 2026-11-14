type Mapping = { supplierVariantKey: string | null; supplierVariantId: string | null; supplierSku: string | null; mappingStatus: string | null };

const normalize = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[^a-z0-9]+/g, "").trim();

/** Match the customer’s colour/size choices to a verified CJ option key without depending on one exact separator format. */
export function matchCjVariant<T extends Mapping>(mappings: T[], color?: string | null, size?: string | null): T | null {
  const values = [color?.trim(), size?.trim()].filter((value): value is string => Boolean(value));
  if (!values.length) return null;

  const normalized = values.map(normalize);
  const candidates = new Set<string>();
  if (normalized.length === 1) {
    const [token] = normalized;
    if (token) candidates.add(token);
  } else {
    const [first, second] = normalized;
    if (first && second) {
      candidates.add(`${first}${second}`);
      candidates.add(`${second}${first}`);
      candidates.add(`${first}-${second}`);
      candidates.add(`${second}-${first}`);
      candidates.add(`${first}/${second}`);
      candidates.add(`${second}/${first}`);
    }
  }

  const matches = mappings.filter((row) => {
    if (row.mappingStatus !== "ACTIVE" || !row.supplierVariantId || !row.supplierSku || !row.supplierVariantKey) return false;
    const key = normalize(row.supplierVariantKey);
    if (!key) return false;
    if ([...candidates].some(candidate => candidate && key === candidate)) return true;
    if (normalized.length === 2) {
      const [first, second] = normalized;
      return Boolean(first && second && key.includes(first) && key.includes(second));
    }
    return false;
  });

  return matches.length === 1 ? matches[0] : null;
}
