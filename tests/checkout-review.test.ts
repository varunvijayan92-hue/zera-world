import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCart, readCart, CART_KEY } from "../lib/cart";
import { addressFromPhoton, coordinatesSchema } from "../lib/geocoding";
import { readSavedAddress, rememberAddress, readCheckoutDraft, SAVED_ADDRESS_KEY, CHECKOUT_DRAFT_KEY } from "../lib/checkout-storage";
import { upiCheckoutDisplay } from "../lib/razorpay-browser";
import { POST as locateAddress } from "../app/api/address/locate/route";
import { POST as quoteCheckout } from "../app/api/checkout/quote/route";
import { prisma } from "../lib/prisma";

const item = { id: "p1", name: "Lamp", sku: "SKU", sellingPrice: 99.99, quantity: 2 };
const address = { fullName: "Test Buyer", email: "test@example.com", phone: "9999999999", addressLine1: "12 Test Street", city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "India" };
function storage() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
}

test("repeated product selection merges quantities and corrupt browser carts recover safely", () => {
  assert.equal(normalizeCart([item, item])[0].quantity, 4);
  assert.equal(normalizeCart([{ ...item, quantity: 49 }, item])[0].quantity, 50);
  assert.deepEqual(normalizeCart([{ ...item, quantity: -1 }]), []);
  const local = storage();
  local.setItem(CART_KEY, "{broken");
  assert.deepEqual(readCart(local), []);
});

test("delivery addresses are remembered only with opt-in and can be reused or forgotten", () => {
  const local = storage();
  rememberAddress(local, address, false);
  assert.equal(readSavedAddress(local), null);
  rememberAddress(local, address, true);
  assert.deepEqual(readSavedAddress(local), address);
  rememberAddress(local, { ...address, addressLine1: "One-time delivery" }, false);
  assert.equal(readSavedAddress(local)?.addressLine1, "12 Test Street");
  local.removeItem(SAVED_ADDRESS_KEY);
  assert.equal(readSavedAddress(local), null);
});

test("payment requires a valid, recently confirmed checkout draft", () => {
  const session = storage();
  const now = Date.now();
  assert.equal(readCheckoutDraft(session), null);
  session.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ items: [item], shippingAddress: address, createdAt: now, amount: { subtotal: 199.98, shippingCharges: 120, taxes: 10, total: 329.98, currency: "INR" } }));
  assert.equal(readCheckoutDraft(session, now)?.items[0].quantity, 2);
  assert.equal(readCheckoutDraft(session, now + 31 * 60 * 1000), null);
});

test("GPS address suggestions map street, city and postcode without inventing missing fields", () => {
  assert.deepEqual(addressFromPhoton({ features: [{ properties: { housenumber: "12", street: "Test Street", city: "Bengaluru", state: "Karnataka", postcode: "560001", country: "India" } }] }), {
    addressLine1: "12 Test Street", addressLine2: "", city: "Bengaluru", state: "Karnataka", pincode: "560001", country: "India",
  });
  assert.equal(addressFromPhoton({ features: [] }), null);
  assert.equal(addressFromPhoton({ features: [{ properties: { city: "Bengaluru" } }] })?.pincode, "");
  assert.equal(coordinatesSchema.safeParse({ latitude: 91, longitude: 0 }).success, false);
});

test("GPS lookup rejects invalid coordinates and handles unavailable providers", async (t) => {
  const call = (body: unknown) => locateAddress(new Request("http://localhost/api/address/locate", { method: "POST", body: JSON.stringify(body) }));
  const upstream = t.mock.method(globalThis, "fetch", async () => Response.json({ features: [{ properties: { street: "Test Street", city: "Bengaluru" } }] }));
  assert.equal((await call({ latitude: 999, longitude: 0 })).status, 400);
  assert.equal(upstream.mock.callCount(), 0);
  const response = await call({ latitude: 12.97, longitude: 77.59 });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal((await response.json()).address.city, "Bengaluru");
  upstream.mock.mockImplementation(async () => { throw Error("Offline"); });
  assert.equal((await call({ latitude: 12.97, longitude: 77.59 })).status, 502);
});

test("order review quotes the chosen quantity without creating orders or payments", async (t) => {
  const original = { product: prisma.product, customerOrder: prisma.customerOrder, paymentTransaction: prisma.paymentTransaction };
  let writes = 0;
  Object.assign(prisma, {
    product: { findMany: async () => [{ ...item, status: "ACTIVE", imageUrls: [], inventory: [{ availableQty: 5, reservedQty: 0 }] }] },
    customerOrder: { create: async () => { writes++; } }, paymentTransaction: { create: async () => { writes++; } },
  });
  t.after(() => Object.assign(prisma, original));
  const result = await quoteCheckout(new Request("http://localhost/api/checkout/quote", { method: "POST", body: JSON.stringify({ cart: [{ productId: "p1", sku: "SKU", quantity: 2 }] }) }));
  assert.equal(result.status, 200);
  const quote = await result.json();
  assert.equal(quote.items[0].quantity, 2);
  assert.equal(quote.amount.total, 329.98);
  assert.equal(writes, 0);
});

test("payment choices use Razorpay UPI instruments and QR flow", () => {
  assert.deepEqual(upiCheckoutDisplay("qr").config.display.blocks.upi.instruments, [{ method: "upi", flows: ["qr"] }]);
  assert.deepEqual(upiCheckoutDisplay("upi").config.display.blocks.upi.instruments, [{ method: "upi" }]);
});
