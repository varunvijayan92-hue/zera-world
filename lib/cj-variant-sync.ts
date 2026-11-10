import { z } from "zod";

const cjVariant = z.object({ vid: z.string().trim().min(1).max(100), pid: z.string().trim().min(1).max(100), variantSku: z.string().trim().min(1).max(100), variantNameEn: z.string().trim().min(1).max(255), variantKey: z.string().trim().max(255).nullish() });
const cjProduct = z.object({ pid: z.string().min(1).max(100), variants: z.array(cjVariant).min(1).max(200) });

export function parseCjSyncVariants(productId: string, value: unknown) {
  const parsed = cjProduct.safeParse(value);
  if (!parsed.success || parsed.data.pid !== productId) throw new Error("CJ did not return a valid complete product and variant list.");
  const variants = parsed.data.variants;
  if (variants.some(variant => variant.pid !== productId) || new Set(variants.map(variant => variant.vid)).size !== variants.length || new Set(variants.map(variant => variant.variantSku)).size !== variants.length) throw new Error("CJ returned conflicting product variants; no changes were made.");
  return variants;
}

type ExistingVariant = { id: string; productId: string; sku: string; variantName: string };
type ExistingMapping = { id: string; variantId: string | null; externalProductId: string | null; supplierVariantId: string | null; supplierSku: string | null; mappingStatus: string | null };

export function planCjVariantSync(input: { productId: string; supplierId: string; cjProductId: string; incoming: ReturnType<typeof parseCjSyncVariants>; variants: ExistingVariant[]; mappings: ExistingMapping[]; newId: () => string }) {
  const { productId, supplierId, cjProductId, incoming, variants, mappings } = input;
  if (variants.some(variant => variant.productId !== productId && incoming.some(item => item.variantSku === variant.sku))) throw new Error("A CJ SKU belongs to another store product. Resolve the duplicate before syncing.");
  if (mappings.some(mapping => mapping.externalProductId && mapping.externalProductId !== cjProductId)) throw new Error("This product already has mappings to another CJ product. Review them before syncing.");
  const newVariants: { id: string; productId: string; sku: string; variantName: string }[] = [];
  const newMappings: { productId: string; supplierId: string; variantId: string; externalProductId: string; supplierVariantId: string; supplierSku: string; mappingStatus: string; supplierAvailability: string }[] = [];
  const updates: { id: string; name: string }[] = [];
  const activateMappingIds: string[] = [];
  for (const item of incoming) {
    const existing = variants.find(variant => variant.productId === productId && variant.sku === item.variantSku);
    const localId = existing?.id || input.newId();
    const candidates = mappings.filter(mapping => mapping.supplierVariantId === item.vid || mapping.variantId === localId);
    if (candidates.length > 1 || candidates.some(mapping => mapping.supplierVariantId !== item.vid || mapping.supplierSku !== item.variantSku || mapping.variantId !== localId || mapping.externalProductId !== cjProductId)) throw new Error("An existing mapping conflicts with CJ. Review it before syncing.");
    if (!existing) newVariants.push({ id: localId, productId, sku: item.variantSku, variantName: item.variantNameEn });
    else if (existing.variantName !== item.variantNameEn) updates.push({ id: existing.id, name: item.variantNameEn });
    if (!candidates.length) newMappings.push({ productId, supplierId, variantId: localId, externalProductId: cjProductId, supplierVariantId: item.vid, supplierSku: item.variantSku, mappingStatus: "ACTIVE", supplierAvailability: "UNKNOWN" });
    else if (candidates[0].mappingStatus === "PENDING") activateMappingIds.push(candidates[0].id);
  }
  const stale = mappings.filter(mapping => mapping.externalProductId === cjProductId && mapping.supplierVariantId && !incoming.some(item => item.vid === mapping.supplierVariantId)).length;
  return { newVariants, newMappings, updates, activateMappingIds, stale };
}
