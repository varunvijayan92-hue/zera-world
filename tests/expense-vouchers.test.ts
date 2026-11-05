import assert from "node:assert/strict";
import test from "node:test";
import { expenseVoucherSchema, voucherDescription } from "../lib/expense-vouchers";
import { POST } from "../app/api/admin/accounts/vouchers/route";
import { authContext } from "../lib/auth";

const voucher = { submissionId: "4b2e4f4f-e7c5-49ca-88cf-d936a32db32b", category: "Courier", payee: "Courier company", reference: "BILL-1", paymentMethod: "UPI", paymentReference: "UPI-1", description: "Parcel postage", amount: 120.5, date: "2026-11-05", confirmedNotRecorded: true };
test("expense vouchers require exact money, a real date, a payee and duplicate-cost confirmation", () => {
  assert.equal(expenseVoucherSchema.safeParse(voucher).success, true);
  for (const patch of [{ amount: 0 }, { amount: 1.234 }, { amount: Infinity }, { date: "2026-02-30" }, { payee: " " }, { confirmedNotRecorded: false }, { submissionId: "invalid" }, { category: "Gift card" }]) assert.equal(expenseVoucherSchema.safeParse({ ...voucher, ...patch }).success, false);
  for (const category of ["Courier", "Packing materials", "Stationery", "Other purchases"]) assert.equal(expenseVoucherSchema.safeParse({ ...voucher, category }).success, true);
  assert.match(voucherDescription(expenseVoucherSchema.parse(voucher)), /Payee: Courier company; Payment: UPI; Bill: BILL-1; Payment reference: UPI-1/);
});
test("expense voucher API rejects anonymous, customer, supplier and cross-origin requests before any write", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = () => new Request("https://zerasworld.in/api/admin/accounts/vouchers", { method: "POST", headers: { origin: "https://zerasworld.in", "Content-Type": "application/json" }, body: JSON.stringify(voucher) });
  assert.equal((await POST(request())).status, 401);
  for (const role of ["CUSTOMER", "SUPPLIER"] as const) {
    actor.mock.mockImplementation(async () => ({ id: "u", role, email: "u@example.test", fullName: "User", isActive: true }));
    assert.equal((await POST(request())).status, 403);
  }
  assert.equal((await POST(new Request("https://zerasworld.in/api/admin/accounts/vouchers", { method: "POST", headers: { origin: "https://other.example" } }))).status, 403);
});
