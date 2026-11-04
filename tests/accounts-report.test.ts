import assert from "node:assert/strict";
import test from "node:test";
import { accountTotals, filterAccountRows, accountsCsv, type AccountRow, accountsReport } from "../lib/accounts-report";
import { GET } from "../app/api/admin/accounts/export/route";
import { authContext } from "../lib/auth";

const row = (id: string, patch: Partial<AccountRow> = {}): AccountRow => ({ id, kind: "PAYMENT", date: new Date("2026-11-04T08:00:00Z"), reference: "Order 1", party: "Buyer", method: "RAZORPAY", amount: 100.01, currency: "INR", status: "PAID", description: "Reference", href: "/admin/payments", ...patch });

test("account totals separate pending payments, gift credit, refunds, costs and supplier settlements", () => {
  const rows = [row("paid"), row("pending", { status: "PENDING" }), row("failed", { status: "FAILED" }), row("gift", { method: "GIFT_CARD", amount: 80 }), row("cash-refund", { kind: "REFUND", status: "SUCCESS", amount: 20 }), row("pending-refund", { kind: "REFUND", status: "PENDING", amount: 70 }), row("gift-refund", { kind: "REFUND", method: "GIFT_CARD", status: "SUCCESS", amount: 10 }), row("unknown-refund", { kind: "REFUND", method: "UNKNOWN", status: "SUCCESS", amount: 30 }), row("expense", { kind: "EXPENSE", amount: 4.99 }), row("supplier", { kind: "SUPPLIER_PAYMENT", amount: 50 }), row("shipping", { kind: "SHIPMENT_COST", amount: 12 }), row("issue", { kind: "GIFT_CARD_ISSUED", amount: 200 }), row("legacy-issue", { kind: "GIFT_CARD_ISSUED", amount: null }), row("usd", { currency: "USD", amount: 900 })];
  assert.deepEqual(accountTotals(rows), { receipts: 100.01, giftSpent: 80, cashRefunds: 20, giftRefunds: 10, expenses: 4.99, supplierPayments: 50, shippingCosts: 12, giftIssued: 200 });
});

test("transaction filters and ordering are deterministic and include references and parties", () => {
  const rows = [row("b"), row("a", { party: "Supplier Example", kind: "SUPPLIER_PAYMENT", status: "RECORDED" }), row("new", { date: new Date("2026-11-04T09:00:00Z") })];
  assert.deepEqual(filterAccountRows(rows, { kind: "ALL", status: "", q: "" }).map(row => row.id), ["new", "a", "b"]);
  assert.deepEqual(filterAccountRows(rows, { kind: "SUPPLIER_PAYMENT", status: "RECORDED", q: "SUPPLIER EXAMPLE" }).map(row => row.id), ["a"]);
  assert.equal(filterAccountRows(rows, { kind: "REFUND", status: "", q: "" }).length, 0);
});

test("CSV exports filtered transactions with currency, safe spreadsheet cells and distinct P&L summaries", () => {
  const report = { rows: [row("a", { party: '=HYPERLINK("malicious")', reference: "Order, quoted", description: "Line\nnext" })], from: "2026-11-01", to: "2026-11-04", profit: { gross: 100, gst: 5, handling: 0, costs: 40, shippingCosts: 10, expenseTotal: 3, refundTotal: 2, estimatedProfit: 40 } } as unknown as Awaited<ReturnType<typeof accountsReport>>;
  const csv = accountsCsv(report);
  assert.ok(csv.startsWith("\ufeff"));
  assert.match(csv, /"Currency","Amount"/); assert.ok(csv.includes('"\'=HYPERLINK(""malicious"")"'));
  assert.match(csv, /"TRANSACTION","PAYMENT"/); assert.match(csv, /"PROFIT_AND_LOSS","Estimated profit \/ loss"/);
  assert.match(csv, /"INR","40","ESTIMATE"/);
});

test("accounts export blocks visitors, customers and suppliers and rejects invalid filters before querying", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = (query = "") => new Request(`https://store.example/api/admin/accounts/export${query}`);
  assert.equal((await GET(request())).status, 401);
  for (const role of ["CUSTOMER", "SUPPLIER"] as const) {
    actor.mock.mockImplementation(async () => ({ id: "u", role, email: "u@example.test", fullName: "User", isActive: true }));
    assert.equal((await GET(request())).status, 403);
  }
  actor.mock.mockImplementation(async () => ({ id: "a", role: "ADMIN", email: "a@example.test", fullName: "Admin", isActive: true }));
  assert.equal((await GET(request("?from=2026-02-30&to=2026-03-01"))).status, 400);
  assert.equal((await GET(request("?kind=UNKNOWN"))).status, 400);
  assert.equal((await GET(request("?from=2020-01-01&to=2026-11-04"))).status, 400);
});
