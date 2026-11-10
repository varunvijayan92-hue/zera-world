import assert from "node:assert/strict";
import test from "node:test";
import { formatSupplierPickupAddress } from "../lib/supplier-address";
import { supplierSchema } from "../lib/validators";

test("supplier registration stores and validates the chosen COD collection arrangement", () => {
  assert.equal(supplierSchema.parse({ companyName: "Supplier", sourceType: "EXTERNAL_SITE", codHandling: "EITHER" }).codHandling, "EITHER");
  assert.equal(supplierSchema.parse({ companyName: "Supplier" }).codHandling, "NONE");
  assert.equal(supplierSchema.safeParse({ companyName: "Supplier", codHandling: "UNKNOWN" }).success, false);
});
import { priceCheckout } from "../lib/checkout";
import { authContext } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { PATCH } from "../app/api/admin/suppliers/[id]/address/route";

test("supplier registration retains and trims local pickup fields", () => {
  const data = supplierSchema.parse({ companyName: "Supplier", pickupAddressLine1: " 12 Main Road ", pickupCity: " Kochi ", pickupCountry: "India", pickupPincode: "682001" });
  assert.equal(data.pickupAddressLine1, "12 Main Road");
  assert.equal(formatSupplierPickupAddress(data), "12 Main Road, Kochi, India, 682001");
  assert.equal(formatSupplierPickupAddress({ pickupCountry: "India", pickupCity: " " }), null);
});

test("delivery is included in the selling price regardless of order value", () => {
  for (const sellingPrice of [100, 1500]) {
    const result = priceCheckout([{ productId: "p", sku: "SKU", quantity: 1 }], [{ id: "p", sku: "SKU", status: "ACTIVE", sellingPrice, inventory: [{ availableQty: 10, reservedQty: 0 }] }]);
    assert.equal(result.shippingCharges, 0);
  }
});

test("admin address edits enforce role and origin and clear stale pickup mappings", async t => {
  const actor = t.mock.method(authContext, "current", async () => ({ id: "a", role: "ADMIN", isActive: true, email: "a@example.test", fullName: "Admin" }));
  const request = (origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/s/address", { method: "PATCH", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ pickupAddressLine1: "New road", pickupCity: "Kochi" }) });
  const context = { params: Promise.resolve({ id: "s" }) };
  let saved: Record<string, unknown> = {}, audited = false;
  const tx = { supplier: { findUnique: async () => ({ pickupAddress: "Old road", shiprocketPickupLocation: "OLD" }), update: async ({ data }: { data: typeof saved }) => { saved = data; } }, auditLog: { create: async () => { audited = true; } } };
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  assert.equal((await PATCH(request("https://evil.example"), context)).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "s", role: "SUPPLIER", isActive: true, email: "s@example.test", fullName: "Supplier" }));
  assert.equal((await PATCH(request(), context)).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "a", role: "ADMIN", isActive: true, email: "a@example.test", fullName: "Admin" }));
  assert.equal((await PATCH(request(), context)).status, 200);
  assert.equal(saved.pickupAddress, "New road, Kochi");
  assert.equal(saved.shiprocketPickupLocation, null);
  assert.equal(Object.hasOwn(saved, "companyAddress"), false);
  assert.equal(audited, true);
});
