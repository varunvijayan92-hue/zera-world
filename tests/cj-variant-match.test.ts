import test from "node:test";
import assert from "node:assert/strict";
import { matchCjVariant } from "../lib/cj-variant-match";

const olive = { supplierVariantKey: "Olive-73CM", supplierVariantId: "v1", supplierSku: "sku1", mappingStatus: "ACTIVE" };
test("matches customer colour and size to one verified CJ mapping", () => {
  assert.equal(matchCjVariant([olive], "Olive", "73 cm")?.supplierVariantId, "v1");
  assert.equal(matchCjVariant([olive], "Olive", "80 cm"), null);
  assert.equal(matchCjVariant([olive], "Olive", undefined), null);
});
test("rejects ambiguous, inactive and incomplete mappings", () => {
  assert.equal(matchCjVariant([olive, { ...olive, supplierVariantId: "v2" }], "olive", "73cm"), null);
  assert.equal(matchCjVariant([{ ...olive, mappingStatus: "PENDING" }], "olive", "73cm"), null);
  assert.equal(matchCjVariant([{ ...olive, supplierSku: null }], "olive", "73cm"), null);
});
