import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMobilePricing } from "../lib/mobile-product-pricing";

test("converts USD and applies markup on rounded INR cost", () => {
  assert.deepEqual(calculateMobilePricing({ usdCost: 4.49, exchangeRate: 85, markupPercent: 10 }), { currency: "INR", costPrice: 381.65, sellingPrice: 419.82, markupPercent: 10 });
});
test("supports INR and zero markup", () => {
  assert.equal(calculateMobilePricing({ costPrice: 100, markupPercent: 0 }).sellingPrice, 100);
});
test("rejects ambiguous, incomplete, invalid and overflowing prices", () => {
  for (const input of [{}, { usdCost: 1 }, { costPrice: 1, usdCost: 1, exchangeRate: 85 }, { costPrice: -1 }, { costPrice: Infinity }, { costPrice: null }, { costPrice: 9999999999, markupPercent: 100 }, { usdCost: 9999999999, exchangeRate: 100 }]) {
    assert.throws(() => calculateMobilePricing(input));
  }
});
