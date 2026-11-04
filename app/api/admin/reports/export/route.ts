import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { financeReport, csvCell, reportPeriod } from "@/lib/finance-report";
export async function GET(request: Request) {
  try {
    await portalUser("ADMIN"); const params = new URL(request.url).searchParams;
    try { reportPeriod(params.get("from") || undefined, params.get("to") || undefined); } catch (error) { throw new AccessError((error as Error).message); }
    const report = await financeReport(params.get("from") || undefined, params.get("to") || undefined);
    const rows: unknown[][] = [["Type", "Reference", "Date", "Gross INR", "GST INR", "Handling INR", "Cost / expense", "Status / description", "Currency"]];
    for (const order of report.sales) rows.push(["SALE", order.marketplaceOrderId, order.createdAt.toISOString(), order.totalAmount, order.taxAmount, order.handlingAmount, order.orderItems.reduce((sum, item) => sum + Number(item.costPrice || 0) * item.quantity, 0), order.status, "INR"]);
    for (const expense of report.expenses) rows.push(["EXPENSE", expense.category, expense.expenseDate.toISOString(), "", "", "", expense.amount, expense.description, expense.currency]);
    for (const entry of report.returns) rows.push(["RETURN", entry.customerOrder.marketplaceOrderId, entry.createdAt.toISOString(), "", "", "", "", `${entry.status}; ${entry.quantity} units; ${entry.reason || ""}`, ""]);
    for (const refund of report.refunds) rows.push(["REFUND", refund.gatewayRefundId || refund.id, refund.createdAt.toISOString(), "", "", "", refund.amount, refund.status, refund.currency]);
    rows.push(["SUMMARY", "Estimated profit", `${report.from} to ${report.to}`, report.gross, report.gst, report.handling, report.expenseTotal + report.costs + report.shippingCosts + report.refundTotal, report.estimatedProfit, "INR"]);
    return new Response("\ufeff" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="zera-finance-${report.from}-${report.to}.csv"`, "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
