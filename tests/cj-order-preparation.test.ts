import { test } from "node:test";
import { strict as assert } from "node:assert";
import { cjCostReview, cjWalletReview, prepareCjCreateOrder, prepareCjOrderLines } from "../lib/cj-order-preparation";

const mappings = [
  { supplierVariantKey: "Olive-66cm", supplierVariantId: "111", supplierSku: "OLIVE66", mappingStatus: "ACTIVE" },
  { supplierVariantKey: "Floral-66cm", supplierVariantId: "222", supplierSku: "FLORAL66", mappingStatus: "ACTIVE" },
];
test("CJ order lines use the selected colour and size", () => {
  assert.deepEqual(prepareCjOrderLines([{ id: "line1", quantity: 2, color: "Olive", size: "66 cm", mappings }]), [{ vid: "111", sku: "OLIVE66", quantity: 2, storeLineItemId: "line1" }]);
});
test("CJ order lines reject ambiguous and inactive mappings", () => {
  assert.throws(() => prepareCjOrderLines([{ id: "line1", quantity: 1, color: "Olive", size: "66cm", mappings: [mappings[0], mappings[0]] }]));
  assert.throws(() => prepareCjOrderLines([{ id: "line1", quantity: 1, color: "Olive", size: "66cm", mappings: [{ ...mappings[0], mappingStatus: "INACTIVE" }] }]));
});
test("CJ cost review fails closed and holds orders above the sale", () => {
  const input = { saleInr: 100, costUsd: 2, usdToInr: 85, shippingMethod: "DHL Official", approvedMethods: ["DHL Official"] };
  assert.equal(cjCostReview(input), "CJ cost exceeds the sale");
  assert.equal(cjCostReview({ ...input, costUsd: 1 }), null);
  assert.ok(cjCostReview({ ...input, usdToInr: NaN }));
  assert.ok(cjCostReview({ ...input, approvedMethods: [] }));
});
test("CJ payload carries the selected variant and destination without paying CJ", () => {
  const result = prepareCjCreateOrder({ orderNumber: "order-1", origin: "CN", logisticName: "DHL Official", address: { fullName: "Test Customer", email: "test@example.com", phone: "9999999999", addressLine1: "Street", city: "Kochi", state: "Kerala", pincode: "682001", country: "India" }, lines: [{ id: "line1", quantity: 2, color: "Olive", size: "66 cm", mappings }] });
  assert.equal(result.payType, 3);
  assert.equal(result.shippingZip, "682001");
  assert.equal(result.logisticName, "DHL Official");
  assert.deepEqual(result.products, [{ vid: "111", sku: "OLIVE66", quantity: 2, storeLineItemId: "line1" }]);
});
test("wallet review holds missing and insufficient balances", () => {
  assert.equal(cjWalletReview({ totalUsd: 12.50, balanceUsd: 12.49 }), "Insufficient CJ Wallet balance");
  assert.equal(cjWalletReview({ totalUsd: 12.50, balanceUsd: 12.50 }), null);
  assert.ok(cjWalletReview({ totalUsd: 12.50, balanceUsd: NaN }));
  assert.ok(cjWalletReview({ totalUsd: 0, balanceUsd: 100 }));
});
