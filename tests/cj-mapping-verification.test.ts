import assert from "node:assert/strict";
import test from "node:test";
import { verifiedCjMappingIds } from "../lib/cj-mapping-verification";

test("CJ mapping verification only accepts matching and unambiguous product, variant and SKU", () => {
  const mapping = { id: "m", externalProductId: "p", supplierVariantId: "cv", supplierSku: "sku", variantId: "v", mappingStatus: "PENDING" };
  const variants = [{ id: "v", sku: "sku" }];
  const cj = { pid: "p", variants: [{ vid: "cv", variantSku: "sku" }] };
  assert.deepEqual(verifiedCjMappingIds("p", [mapping], variants, cj), ["m"]);
  assert.deepEqual(verifiedCjMappingIds("p", [mapping, { ...mapping, id: "m2" }], variants, cj), []);
  assert.deepEqual(verifiedCjMappingIds("p", [mapping], [{ id: "v", sku: "wrong" }], cj), []);
  assert.deepEqual(verifiedCjMappingIds("p", [mapping], variants, { pid: "p", variants: [{ vid: "cv", variantSku: "other" }] }), []);
  assert.throws(() => verifiedCjMappingIds("p", [mapping], variants, { pid: "other", variants: [] }));
});
