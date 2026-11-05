import { z } from "zod";
import { prisma } from "./prisma";
import { financeReport, reportPeriod, csvCell } from "./finance-report";
import { AccessError } from "./portal-access";

export const accountKinds = ["PAYMENT", "REFUND", "EXPENSE", "SUPPLIER_PAYMENT", "SHIPMENT_COST", "GIFT_CARD_ISSUED"] as const;
export const accountsFilterSchema = z.object({ from: z.string().optional(), to: z.string().optional(), kind: z.enum(["ALL", ...accountKinds]).default("ALL"), status: z.string().trim().max(40).default(""), q: z.string().trim().max(100).default("") });
export type AccountRow = { id: string; kind: typeof accountKinds[number]; date: Date; reference: string; party: string; method: string; amount: number | null; currency: string; status: string; description: string; href: string };
export function filterAccountRows(rows: AccountRow[], filter: { kind: string; status: string; q: string }) {
  const search = filter.q.toLowerCase();
  return rows.filter(row => (filter.kind === "ALL" || row.kind === filter.kind) && (!filter.status || row.status === filter.status) && (!search || [row.reference, row.party, row.method, row.description, row.id].join(" ").toLowerCase().includes(search))).sort((a, b) => b.date.getTime() - a.date.getTime() || a.id.localeCompare(b.id));
}
const paid = new Set(["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]);
const processed = (status: string) => ["SUCCESS", "PROCESSED", "processed"].includes(status);
export function accountTotals(rows: AccountRow[]) {
  const sum = (kind: AccountRow["kind"], eligible: (row: AccountRow) => boolean = () => true) => rows.filter(row => row.kind === kind && row.currency === "INR" && eligible(row)).reduce((value, row) => value + Math.round((row.amount || 0) * 100), 0) / 100;
  return { receipts: sum("PAYMENT", row => paid.has(row.status) && row.method !== "GIFT_CARD"), giftSpent: sum("PAYMENT", row => paid.has(row.status) && row.method === "GIFT_CARD"), cashRefunds: sum("REFUND", row => processed(row.status) && !["GIFT_CARD", "UNKNOWN"].includes(row.method)), giftRefunds: sum("REFUND", row => processed(row.status) && row.method === "GIFT_CARD"), expenses: sum("EXPENSE"), supplierPayments: sum("SUPPLIER_PAYMENT"), shippingCosts: sum("SHIPMENT_COST"), giftIssued: sum("GIFT_CARD_ISSUED") };
}

export async function accountsReport(input: unknown) {
  const parsed = accountsFilterSchema.safeParse(input);
  if (!parsed.success) throw new AccessError("Choose valid transaction filters. Search is limited to 100 characters.");
  const filter = parsed.data;
  let period: ReturnType<typeof reportPeriod>;
  try { period = reportPeriod(filter.from, filter.to); } catch (error) { throw new AccessError((error as Error).message); }
  const limit = 10001;
  const [payments, refunds, expenses, settlements, shipments, cards, profit] = await Promise.all([
    prisma.paymentTransaction.findMany({ where: { OR: [{ verificationTimestamp: period.range }, { verificationTimestamp: null, createdAt: period.range }] }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.refund.findMany({ where: { createdAt: period.range }, include: { returnRequest: { select: { customerOrderId: true, reason: true } } }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.expense.findMany({ where: { expenseDate: period.range }, orderBy: { expenseDate: "desc" }, take: limit }),
    prisma.supplierSettlement.findMany({ where: { paidAt: period.range }, orderBy: { paidAt: "desc" }, take: limit }),
    prisma.shipment.findMany({ where: { createdAt: period.range, shipmentCost: { not: null } }, include: { customerOrder: { select: { marketplaceOrderId: true } } }, orderBy: { createdAt: "desc" }, take: limit }),
    prisma.customerVoucher.findMany({ where: { createdAt: period.range }, include: { customer: { select: { fullName: true, email: true } } }, orderBy: { createdAt: "desc" }, take: limit }),
    financeReport(period.from, period.to),
  ]);
  if (payments.length + refunds.length + expenses.length + settlements.length + shipments.length + cards.length > 10000) throw new AccessError("This period contains more than 10,000 transactions. Choose a shorter date range for a complete report and export.");
  const orderIds = [...new Set([...payments.map(row => row.orderId), ...refunds.map(row => row.returnRequest.customerOrderId)])];
  const [orders, suppliers, refundPayments, issues, vouchers] = await Promise.all([
    prisma.customerOrder.findMany({ where: { id: { in: orderIds } }, select: { id: true, marketplaceOrderId: true, customerName: true } }),
    prisma.supplier.findMany({ where: { id: { in: [...new Set(settlements.map(row => row.supplierId))] } }, select: { id: true, companyName: true } }),
    prisma.paymentTransaction.findMany({ where: { orderId: { in: refunds.map(row => row.returnRequest.customerOrderId) }, paymentStatus: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } }, select: { orderId: true, provider: true } }),
    prisma.auditLog.findMany({ where: { action: "ISSUE_GIFT_CARD", entityType: "CustomerVoucher", entityId: { in: cards.map(card => card.id) } }, select: { entityId: true, details: true } }),
    prisma.auditLog.findMany({ where: { action: "CREATE_EXPENSE_VOUCHER", entityType: "Expense", entityId: { in: expenses.map(expense => expense.id) } }, select: { entityId: true, details: true } }),
  ]);
  const orderMap = new Map(orders.map(order => [order.id, order])), supplierMap = new Map(suppliers.map(supplier => [supplier.id, supplier.companyName]));
  const rows: AccountRow[] = [];
  for (const payment of payments) {
    const order = orderMap.get(payment.orderId);
    rows.push({ id: `payment:${payment.id}`, kind: "PAYMENT", date: payment.verificationTimestamp || payment.createdAt, reference: order?.marketplaceOrderId || payment.orderId, party: order?.customerName || "Customer not recorded", method: payment.provider, amount: payment.amount == null ? null : Number(payment.amount), currency: payment.currency, status: payment.paymentStatus, description: payment.gatewayPaymentId || payment.gatewayOrderId || (payment.provider === "GIFT_CARD" ? "Gift-card redemption; store credit" : "No gateway reference recorded"), href: `/admin/orders?order=${encodeURIComponent(payment.orderId)}` });
  }
  for (const refund of refunds) {
    const orderId = refund.returnRequest.customerOrderId, order = orderMap.get(orderId), method = refundPayments.find(payment => payment.orderId === orderId)?.provider || "UNKNOWN";
    rows.push({ id: `refund:${refund.id}`, kind: "REFUND", date: refund.createdAt, reference: order?.marketplaceOrderId || orderId, party: order?.customerName || "Customer not recorded", method, amount: Number(refund.amount), currency: refund.currency, status: processed(refund.status) ? "SUCCESS" : refund.status.toUpperCase(), description: [refund.gatewayRefundId || refund.id, refund.returnRequest.reason].filter(Boolean).join("; "), href: "/admin/returns" });
  }
  const voucherMap = new Map(vouchers.map(voucher => [voucher.entityId, voucher.details]));
  for (const expense of expenses) {
    const saved = voucherMap.get(expense.id);
    const voucher = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : null;
    rows.push({ id: `expense:${expense.id}`, kind: "EXPENSE", date: expense.expenseDate, reference: typeof voucher?.number === "string" ? voucher.number : expense.category, party: typeof voucher?.payee === "string" ? voucher.payee : expense.category, method: typeof voucher?.paymentMethod === "string" ? voucher.paymentMethod : "RECORDED_EXPENSE", amount: Number(expense.amount), currency: expense.currency, status: "RECORDED", description: expense.description || "", href: voucher ? `/admin/accounts/vouchers/${expense.id}` : `/admin/profit-expenses?from=${period.from}&to=${period.to}` });
  }
  for (const settlement of settlements) rows.push({ id: `settlement:${settlement.id}`, kind: "SUPPLIER_PAYMENT", date: settlement.paidAt, reference: settlement.reference, party: supplierMap.get(settlement.supplierId) || "Supplier not recorded", method: "SUPPLIER_SETTLEMENT", amount: Number(settlement.amount), currency: "INR", status: "RECORDED", description: settlement.notes || "", href: "/admin/suppliers" });
  for (const shipment of shipments) rows.push({ id: `shipment:${shipment.id}`, kind: "SHIPMENT_COST", date: shipment.createdAt, reference: shipment.customerOrder.marketplaceOrderId, party: shipment.courierName || "Courier not recorded", method: "COURIER_COST", amount: Number(shipment.shipmentCost), currency: "INR", status: shipment.status, description: shipment.trackingNumber || "No AWB recorded", href: "/admin/tracking" });
  for (const card of cards) {
    const details = issues.find(issue => issue.entityId === card.id)?.details;
    const original = details && typeof details === "object" && !Array.isArray(details) ? details.amount : undefined;
    const amount = typeof original === "number" && Number.isFinite(original) ? original : null;
    rows.push({ id: `gift:${card.id}`, kind: "GIFT_CARD_ISSUED", date: card.createdAt, reference: `Gift card ending ${card.code.slice(-4)}`, party: `${card.customer.fullName} (${card.customer.email})`, method: "STORE_CREDIT", amount, currency: "INR", status: "ISSUED", description: `Current balance INR ${Number(card.balance).toFixed(2)}. ${amount == null ? "Original issued value not recorded." : "Non-cash issuance."}`, href: "/admin/gift-cards" });
  }
  const filtered = filterAccountRows(rows, filter);
  return { ...period, filter, rows: filtered, totals: accountTotals(filtered), profit, statuses: [...new Set(rows.map(row => row.status))].sort(), totalRecords: rows.length };
}

export function accountsCsv(report: Awaited<ReturnType<typeof accountsReport>>) {
  const rows: unknown[][] = [["Section", "Type", "Transaction ID", "Date (IST)", "Reference", "Party", "Method", "Currency", "Amount", "Status", "Description"]];
  for (const row of report.rows) rows.push(["TRANSACTION", row.kind, row.id, new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "short", timeStyle: "medium" }).format(row.date), row.reference, row.party, row.method, row.currency, row.amount, row.status, row.description]);
  const p = report.profit;
  for (const [label, value] of [["Paid order value", p.gross], ["GST charged", p.gst], ["Handling revenue", p.handling], ["Product costs", p.costs], ["Recorded shipment costs", p.shippingCosts], ["Expenses", p.expenseTotal], ["Processed refunds", p.refundTotal], ["Estimated profit / loss", p.estimatedProfit]] as const) rows.push(["PROFIT_AND_LOSS", label, "", `${report.from} to ${report.to}`, "", "", "", "INR", value, "ESTIMATE", "Same date-period figures as Profit & Expenses; independent of transaction type/status/search filters."]);
  return "\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
