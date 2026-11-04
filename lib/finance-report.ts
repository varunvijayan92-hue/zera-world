import { prisma } from "./prisma";
export function reportPeriod(from?: string, to?: string, now = new Date()) {
  const end = to || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  const start = from || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(now.getTime() - 29 * 86400000));
  const date = (value: string) => { const parsed = new Date(`${value}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; };
  if (!date(start) || !date(end)) throw Error("Enter valid from and to dates.");
  const gte = new Date(`${start}T00:00:00+05:30`); const lt = new Date(new Date(`${end}T00:00:00+05:30`).getTime() + 86400000);
  if (gte >= lt || lt.getTime() - gte.getTime() > 366 * 86400000) throw Error("Choose a date range of up to 366 days, with the start before the end.");
  return { from: start, to: end, range: { gte, lt } };
}
export function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
export async function financeReport(from?: string, to?: string) {
  const period = reportPeriod(from, to);
  const [orders, expenses, returns, refunds] = await Promise.all([
    prisma.customerOrder.findMany({ where: { createdAt: period.range }, include: { orderItems: { select: { quantity: true, costPrice: true } }, shipments: { select: { shipmentCost: true } } }, orderBy: { createdAt: "desc" }, take: 10000 }),
    prisma.expense.findMany({ where: { expenseDate: period.range }, orderBy: { expenseDate: "desc" }, take: 10000 }),
    prisma.returnRequest.findMany({ where: { createdAt: period.range }, include: { customerOrder: { select: { marketplaceOrderId: true } }, refunds: true }, orderBy: { createdAt: "desc" }, take: 10000 }),
    prisma.refund.findMany({ where: { createdAt: period.range, status: { in: ["SUCCESS", "PROCESSED", "processed"] } }, take: 10000 }),
  ]);
  const payments = await prisma.paymentTransaction.findMany({ where: { orderId: { in: orders.map((order) => order.id) }, paymentStatus: { in: ["PAID", "REFUNDED", "PARTIALLY_REFUNDED"] } }, select: { orderId: true } });
  const paid = new Set(payments.map((payment) => payment.orderId)); const sales = orders.filter((order) => paid.has(order.id));
  const gross = sales.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const gst = sales.reduce((sum, order) => sum + Number(order.taxAmount ?? Math.max(0, Number(order.totalAmount || 0) - Number(order.subtotal || 0) - Number(order.shippingAmount || 0))), 0);
  const handling = sales.reduce((sum, order) => sum + Number(order.handlingAmount || 0), 0);
  const costs = sales.reduce((sum, order) => sum + order.orderItems.reduce((line, item) => line + Number(item.costPrice || 0) * item.quantity, 0), 0);
  const shippingCosts = sales.reduce((sum, order) => sum + order.shipments.reduce((value, shipment) => value + Number(shipment.shipmentCost || 0), 0), 0);
  const expenseTotal = expenses.filter(expense => expense.currency === "INR").reduce((sum, expense) => sum + Number(expense.amount), 0);
  const refundTotal = refunds.filter(refund => refund.currency === "INR").reduce((sum, refund) => sum + Number(refund.amount), 0);
  const missingCosts = sales.flatMap((order) => order.orderItems).filter((item) => item.costPrice === null).length;
  const foreignCurrencyRecords = expenses.filter(expense => expense.currency !== "INR").length + refunds.filter(refund => refund.currency !== "INR").length;
  return { ...period, foreignCurrencyRecords, sales, expenses, returns, refunds, gross, gst, handling, costs, shippingCosts, expenseTotal, refundTotal, missingCosts, estimatedProfit: gross - gst - costs - shippingCosts - expenseTotal - refundTotal };
}
