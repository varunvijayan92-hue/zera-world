import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseCjShipment } from "../lib/cj-tracking";

test("reads shipped CJ order tracking and courier", () => {
  assert.deepEqual(parseCjShipment({ orderStatus: "SHIPPED", trackNumber: "AWB123", trackingProvider: "DHL", logisticName: "DHL Official" }), { trackingNumber: "AWB123", courierName: "DHL", status: "IN_TRANSIT" });
});
test("recognizes delivered orders and does not invent tracking", () => {
  assert.equal(parseCjShipment({ orderStatus: "DELIVERED", trackNumber: "AWB123" })?.status, "DELIVERED");
  assert.equal(parseCjShipment({ orderStatus: "SHIPPED", trackNumber: null }), null);
  assert.equal(parseCjShipment({ orderStatus: "UNPAID", trackNumber: "AWB123" }), null);
});
