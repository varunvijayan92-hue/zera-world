import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "@prisma/client";
import { debitGiftCard } from "../lib/gift-card-payment";
import { POST } from "../app/api/payments/checkout/route";
import { POST as refund } from "../app/api/admin/returns/[id]/refund/route";
import { authContext, AUTH_COOKIE } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { razorpayGateway } from "../lib/razorpay";

test("gift-card debit validates ownership, expiry and sufficient balance before a conditional update", async () => {
  let present = true, balance = 500, count = 1, updates = 0;
  const tx = { customerVoucher: { findFirst: async ({ where }: { where: { customerId: string; OR: unknown[] } }) => { assert.equal(where.customerId, "c"); assert.equal(where.OR.length, 2); return present ? { id: "card", balance } : null; }, updateMany: async () => { updates++; return { count }; } } } as unknown as Prisma.TransactionClient;
  assert.equal(await debitGiftCard(tx, "c", "CODE", 240), "card");
  balance = 100; await assert.rejects(debitGiftCard(tx, "c", "CODE", 240), /full order total/);
  present = false; await assert.rejects(debitGiftCard(tx, "c", "CODE", 240), /not found/);
  assert.equal(updates, 1);
  present = true; balance = 500; count = 0; await assert.rejects(debitGiftCard(tx, "c", "CODE", 240), /balance changed/);
});

test("gift-card checkout is paid atomically and an identical retry does not spend twice or expose internal prices", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "c", role: "CUSTOMER", isActive: true, email: "c@example.test", fullName: "Customer" }));
  let balance = 500, orderCount = 0, audits = 0, payment: Record<string, unknown> | null = null;
  const address = { fullName: "Test Buyer", phone: "9999999999", email: "c@example.test", addressLine1: "12 Main Street", addressLine2: "", city: "Kochi", state: "Kerala", pincode: "682001", country: "India", landmark: "" };
  const line = { productId: "p", marketplaceSku: "SKU", quantity: 1, supplierId: null, costPrice: 47 };
  const order = { id: "order", marketplaceOrderId: "ORDER-qa", status: "CONFIRMED", totalAmount: 120, shippingAddress: address, orderItems: [line] };
  const tx = { paymentTransaction: { findUnique: async () => payment, create: async ({ data }: { data: Record<string, unknown> }) => { payment = { id: "payment", ...data }; return payment; } }, product: { findMany: async () => [{ id: "p", sku: "SKU", status: "ACTIVE", sellingPrice: 100, gstRate: 18, handlingCharge: 2, supplierId: null, inventory: [{ availableQty: 10, reservedQty: 0 }] }] }, customerVoucher: { findFirst: async () => ({ id: "card", balance }), updateMany: async () => { balance -= 120; return { count: 1 }; } }, customerOrder: { create: async () => { orderCount++; return order; } }, auditLog: { create: async () => { audits++; } } };
  const original = { $transaction: prisma.$transaction, paymentTransaction: prisma.paymentTransaction, customerOrder: prisma.customerOrder, customerVoucher: prisma.customerVoucher };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx), paymentTransaction: { findUnique: async () => payment }, customerOrder: { findFirst: async () => order }, customerVoucher: { findFirst: async () => ({ id: "card" }) } });
  t.after(() => Object.assign(prisma, original));
  const request = () => new Request("https://store.example/api/create-order", { method: "POST", headers: { Origin: "https://store.example", Cookie: `${AUTH_COOKIE}=unit`, "Content-Type": "application/json" }, body: JSON.stringify({ cart: [{ productId: "p", sku: "SKU", quantity: 1 }], shippingAddress: address, paymentMethod: "gift_card", giftCardCode: "ZWGC-TEST12345678", expectedTotalPaise: 12000, idempotencyKey: "gift-card-retry-reference" }) });
  const response = await POST(request()); assert.equal(response.status, 201);
  const result = await response.json(); assert.equal(result.payment_status, "PAID"); assert.equal(result.data.payment.provider, "GIFT_CARD");
  assert.doesNotMatch(JSON.stringify(result), /costPrice|supplierId|orderItems/);
  assert.equal((await POST(request())).status, 200);
  assert.equal(balance, 380); assert.equal(orderCount, 1); assert.equal(audits, 1);
});

test("gift-card return credit is applied once, includes item GST and never invokes Razorpay", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "admin", role: "ADMIN", isActive: true, email: "a@example.test", fullName: "Admin" }));
  t.mock.method(razorpayGateway, "refund", async () => { throw Error("Must not call Razorpay for gift cards"); });
  let balance = 260, status = "", credits = 0;
  const records: unknown[] = [];
  const tx = { returnRequest: { findUnique: async () => ({ status: "COMPLETED", receivedAt: new Date(), orderItemId: "i", customerOrderId: "o", quantity: 1, refunds: records }) }, orderItem: { findFirst: async () => ({ unitPrice: 100, gstRate: 18, quantity: 1 }) }, paymentTransaction: { findFirst: async () => ({ id: "pay", provider: "GIFT_CARD", giftCardId: "card", paymentStatus: "PAID", amount: 240, currency: "INR", refundStatus: "NOT_REQUESTED" }), update: async ({ data }: { data: { paymentStatus: string } }) => { status = data.paymentStatus; } }, customerVoucher: { findUnique: async () => ({ id: "card", expiresAt: null }), update: async ({ data }: { data: { balance: { increment: string } } }) => { balance += Number(data.balance.increment); credits++; } }, refund: { aggregate: async () => ({ _sum: { amount: 0 } }), create: async ({ data }: { data: unknown }) => { records.push(data); } }, auditLog: { create: async () => ({}) } };
  const original = prisma.$transaction;
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) }); t.after(() => Object.assign(prisma, { $transaction: original }));
  const request = () => new Request("https://store.example/api/admin/returns/r/refund", { method: "POST", headers: { Origin: "https://store.example" } });
  const context = { params: Promise.resolve({ id: "r" }) };
  assert.equal((await refund(request(), context)).status, 200);
  assert.equal(balance, 378); assert.equal(status, "PARTIALLY_REFUNDED");
  assert.equal((await refund(request(), context)).status, 409); assert.equal(credits, 1);
});
