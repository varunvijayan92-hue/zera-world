import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { accountsReport, accountKinds } from "@/lib/accounts-report";
import { reportPeriod } from "@/lib/finance-report";
import { AccessError } from "@/lib/portal-access";
import { AdminHeading, AdminNotice, AdminStat, AdminTable, StateBadge } from "@/components/admin-ui";
import { PrintReceipt } from "@/components/print-receipt";
import { inr } from "@/lib/admin-format";
import { ExpenseVoucherForm } from "@/components/expense-voucher-form";

const label = (value: string) => value.replaceAll("_", " ");
function amount(value: number | null, currency: string) {
  if (value === null) return "Not recorded";
  try { return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(value); }
  catch { return `${currency} ${value.toFixed(2)}`; }
}
export default async function AccountsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireStoreAdmin(); const params = await searchParams;
  let report: Awaited<ReturnType<typeof accountsReport>> | null = null, error = "";
  try { report = await accountsReport(params); } catch (issue) { error = issue instanceof AccessError ? issue.message : "Accounts could not be loaded. Please try again."; }
  const period = report || reportPeriod(), printing = params.print === "1";
  const filter = report?.filter || { kind: "ALL", status: "", q: "" };
  const query = new URLSearchParams({ from: period.from, to: period.to, kind: filter.kind, status: filter.status, q: filter.q });
  const count = report?.rows.length || 0, pages = Math.max(1, Math.ceil(count / 50));
  const requestedPage = /^\d+$/.test(params.page || "") ? Number(params.page) : 1, page = Math.min(pages, Math.max(1, requestedPage));
  const rows = report ? printing ? report.rows : report.rows.slice((page - 1) * 50, page * 50) : [];
  const pageUrl = (value: number) => `/admin/accounts?${query}&page=${value}`;
  return <main className="accounts-report mx-auto max-w-7xl p-5 md:p-8">
    <AdminHeading title="Accounts" description="Recorded payments, refunds, supplier payments, costs and gift-card activity, with the existing profit-and-loss figures.">{printing ? <PrintReceipt label="Print accounts" /> : <Link href={`/admin/accounts?${query}&print=1`} target="_blank" rel="noopener noreferrer" className="rounded-xl border bg-white px-5 py-3 text-sm font-semibold">Print all filtered transactions</Link>}</AdminHeading>
    <form className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
      <label className="text-sm">From<input name="from" type="date" required defaultValue={period.from} className="mt-2 block rounded-xl border bg-white p-3" /></label>
      <label className="text-sm">To<input name="to" type="date" required defaultValue={period.to} className="mt-2 block rounded-xl border bg-white p-3" /></label>
      <label className="text-sm">Transaction type<select name="kind" defaultValue={filter.kind} className="mt-2 block rounded-xl border bg-white p-3"><option value="ALL">All transactions</option>{accountKinds.map(kind => <option key={kind} value={kind}>{label(kind)}</option>)}</select></label>
      <label className="text-sm">Status<select name="status" defaultValue={filter.status} className="mt-2 block rounded-xl border bg-white p-3"><option value="">All statuses</option>{report?.statuses.map(status => <option key={status} value={status}>{label(status)}</option>)}</select></label>
      <label className="min-w-0 text-sm">Search<input name="q" defaultValue={filter.q} maxLength={100} placeholder="Reference, name or description" className="mt-2 block w-full rounded-xl border bg-white p-3" /></label>
      <button className="rounded-xl bg-[#173B35] px-5 py-3 text-white">Search accounts</button>
      {report ? <a href={`/api/admin/accounts/export?${query}`} className="rounded-xl border bg-white px-5 py-3 font-semibold">Export all filtered transactions (CSV)</a> : null}
    </form>
    {!printing ? <><Link href="/admin/accounts/gst" className="mb-5 inline-block rounded-xl border bg-white px-5 py-3 font-semibold">GST return files — setup requirements</Link><ExpenseVoucherForm /></> : null}
    {error ? <AdminNotice>{error}</AdminNotice> : null}
    {report ? <>
      <p className="mb-4 text-sm">{period.from} to {period.to} (India time) · {count} matching transactions{!printing ? ` · Page ${page} of ${pages}` : " · Full filtered report"}{filter.kind !== "ALL" ? ` · ${label(filter.kind)}` : ""}{filter.status ? ` · ${label(filter.status)}` : ""}{filter.q ? ` · Search: ${filter.q}` : ""}</p>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Recorded customer receipts", report.totals.receipts], ["Processed cash refunds", report.totals.cashRefunds], ["Supplier payments recorded", report.totals.supplierPayments], ["Expenses recorded", report.totals.expenses], ["Courier costs recorded", report.totals.shippingCosts], ["Gift cards used (store credit)", report.totals.giftSpent], ["Gift-card refunds (store credit)", report.totals.giftRefunds], ["Gift cards issued (known values)", report.totals.giftIssued]].map(([name, value]) => <AdminStat key={String(name)} label={String(name)} value={inr(value)} />)}</div>
      <AdminNotice>Transaction totals follow the filters above and include INR records only. Pending and failed payments are listed but excluded from receipts. Gift cards are store credit. Courier costs and supplier settlements are separate records; their totals are not subtracted again from the profit estimate below. This report shows saved app records, rather than a bank or marketplace settlement feed.</AdminNotice>
      <h2 className="mb-3 text-xl font-bold">Transactions</h2>
      <AdminTable columns={["Date / type", "Reference / party", "Method", "Amount", "Status", "Details"]} empty="No transactions match these filters.">{rows.map(row => <tr key={row.id}><td><time dateTime={row.date.toISOString()}>{row.date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</time><p className="mt-1 text-xs">{label(row.kind)}</p></td><td><Link href={row.href} className="break-all font-semibold underline print:no-underline">{row.reference}</Link><p className="mt-1 break-all text-[10px] opacity-60">{row.id}</p><p className="mt-1 break-words text-xs">{row.party}</p></td><td>{label(row.method)}</td><td className="whitespace-nowrap">{amount(row.amount, row.currency)}</td><td><StateBadge value={row.status} /></td><td className="max-w-xs break-words text-xs">{row.description}</td></tr>)}</AdminTable>
      {!printing && pages > 1 ? <nav aria-label="Accounts pagination" className="my-5 flex flex-wrap items-center justify-between gap-3 print:hidden">{page > 1 ? <Link href={pageUrl(page - 1)} className="rounded-xl border bg-white px-4 py-2">Previous</Link> : <span /> }<span className="text-sm">Page {page} of {pages}</span>{page < pages ? <Link href={pageUrl(page + 1)} className="rounded-xl border bg-white px-4 py-2">Next</Link> : null}</nav> : null}
      <h2 className="mb-4 mt-8 text-xl font-bold">Profit &amp; loss for this date period</h2>
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Paid order value", report.profit.gross], ["GST charged", report.profit.gst], ["Handling revenue", report.profit.handling], ["Product costs", report.profit.costs], ["Courier costs", report.profit.shippingCosts], ["Expenses", report.profit.expenseTotal], ["Processed refunds", report.profit.refundTotal], ["Estimated profit / loss", report.profit.estimatedProfit]].map(([name, value]) => <AdminStat key={String(name)} label={String(name)} value={inr(value)} />)}</div>
      <p className="text-sm">These are the same date-filtered figures as <Link href={`/admin/profit-expenses?from=${period.from}&to=${period.to}`} className="underline">Profit &amp; Expenses</Link>. Transaction type, status and search do not change this section. Sales use order creation dates; other records use their recorded transaction dates. Refund dates are their creation dates. {report.profit.missingCosts} sold lines have no saved cost. {report.profit.foreignCurrencyRecords} non-INR expense/refund records are excluded from the INR estimate. P&amp;L datasets are limited to 10,000 records each; narrow the date range for larger periods. This remains an estimate; recorded costs and fees must be complete.</p>
    </> : null}
  </main>;
}
