import test from "node:test";
import assert from "node:assert/strict";
import { matchCjVariant } from "../lib/cj-variant-match";

const olive = { supplierVariantKey: "Olive-73CM", supplierVariantId: "v1", supplierSku: "sku1", mappingStatus: "ACTIVE" };
test("matches customer colour and size to one verified CJ mapping", () => {
  assert.equal(matchCjVariant([olive], "Olive", "73 cm")?.supplierVariantId, "v1");
  assert.equal(matchCjVariant([olive], "Olive", "80 cm"), null);
  assert.equal(matchCjVariant([olive], "Olive", undefined), null);
});
test("matches valid CJ keys even when the option formatting differs", () => {
  const key = { supplierVariantKey: "B White & Grey / One Size", supplierVariantId: "v2", supplierSku: "sku2", mappingStatus: "ACTIVE" };
  assert.equal(matchCjVariant([key], "B White & Grey", "One Size")?.supplierVariantId, "v2");
  assert.equal(matchCjVariant([key], "b white & grey", "one size")?.supplierVariantId, "v2");
});
test("rejects ambiguous, inactive and incomplete mappings", () => {
  assert.equal(matchCjVariant([olive, { ...olive, supplierVariantId: "v2" }], "olive", "73cm"), null);
  assert.equal(matchCjVariant([{ ...olive, mappingStatus: "PENDING" }], "olive", "73cm"), null);
  assert.equal(matchCjVariant([{ ...olive, supplierSku: null }], "olive", "73cm"), null);
});
