import assert from "node:assert/strict";
import test from "node:test";
import { customerReorderProduct } from "../lib/customer-reorder";
import { supplierShipmentBill } from "../lib/shipment-bill";

test("reorder uses current public product prices and disables unavailable products", () => {
  const product = { id: "p", name: "Current name", sku: "CURRENT", status: "ACTIVE", sellingPrice: 250, gstRate: 18, handlingCharge: 2, imageUrls: [], inventory: [{ availableQty: 5, reservedQty: 4 }] };
  assert.equal(customerReorderProduct(product)?.sellingPrice, 250);
  assert.equal(customerReorderProduct(product)?.canReorder, true);
  assert.equal(Object.hasOwn(customerReorderProduct(product)!, "inventory"), false);
  assert.equal(customerReorderProduct({ ...product, status: "ARCHIVED" })?.canReorder, false);
  assert.equal(customerReorderProduct({ ...product, inventory: [{ availableQty: 5, reservedQty: 5 }] })?.canReorder, false);
  assert.equal(customerReorderProduct(null), null);
});

test("supplier bills separate GST and delivery while allocating shipping only once", () => {
  const items = [{ supplierId: "a", unitPrice: 100, quantity: 2, gstRate: 18, handlingCharge: 2 }, { supplierId: "b", unitPrice: 50, quantity: 1, gstRate: 5, handlingCharge: 0 }];
  const a = supplierShipmentBill(items, 120.01, "a"), b = supplierShipmentBill(items, 120.01, "b");
  assert.equal(a.subtotal, 200); assert.equal(a.gst, 36); assert.equal(a.handling, 4);
  assert.equal(a.shipping, 60.01); assert.equal(b.shipping, 60);
  assert.equal(Math.round((a.total + b.total) * 100), 41251);
});
