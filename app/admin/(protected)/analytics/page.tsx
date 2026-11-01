import { Prisma } from "@prisma/client";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminStat, AdminTable } from "@/components/admin-ui";

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ days?: string }> }) {
  await requireStoreAdmin();
  const params = searchParams ? await searchParams : {};
  const days = ["7", "30", "90"].includes(params.days || "") ? Number(params.days) : 30;
  const since = new Date(Date.now() - days * 86400000);
  const [orders, paid, products, daily] = await Promise.all([
    prisma.customerOrder.aggregate({ where: { createdAt: { gte: since } }, _count: true, _sum: { totalAmount: true } }),
    prisma.paymentTransaction.aggregate({ where: { paymentStatus: "PAID", createdAt: { gte: since } }, _sum: { amount: true }, _count: true }),
    prisma.product.groupBy({ by: ["status"], _count: true }),
    prisma.$queryRaw<{ day: string; orders: bigint; gross: Prisma.Decimal | null }[]>`SELECT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date::text AS day, COUNT(*)::bigint AS orders, SUM("totalAmount") AS gross FROM "CustomerOrder" WHERE "createdAt" >= ${since} GROUP BY day ORDER BY day ASC`,
  ]);
  const peak = Math.max(1, ...daily.map((row) => Number(row.orders)));
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Analytics" description="Order activity and recorded payment totals. Times are displayed in India Standard Time."><form className="flex gap-2"><label className="sr-only" htmlFor="analytics-days">Reporting period</label><select id="analytics-days" name="days" defaultValue={days} className="rounded-xl border bg-white px-3 py-2"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select><button className="rounded-xl bg-[#173B35] px-4 py-2 text-sm font-semibold text-white">Apply</button></form></AdminHeading><div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AdminStat label="Orders placed" value={orders._count} /><AdminStat label="Order value" value={inr(orders._sum.totalAmount)} detail="All order statuses in this period." /><AdminStat label="Captured payments" value={inr(paid._sum.amount)} detail="Recorded PAID transactions; not net of refunds." /><AdminStat label="Average order value" value={inr(orders._count ? Number(orders._sum.totalAmount || 0) / orders._count : 0)} /></div><section className="mb-7 rounded-2xl border border-[#173B35]/10 bg-white p-6"><h2 className="text-xl font-bold">Daily order activity</h2>{daily.length ? <div className="mt-5 max-h-96 space-y-3 overflow-y-auto pr-2">{daily.map((row) => <div key={row.day} className="flex items-center gap-3 text-xs"><span className="w-24 shrink-0">{row.day}</span><div className="h-6 flex-1 rounded bg-[#F0F2ED]"><div className="h-6 rounded bg-[#173B35]" style={{ width: `${Math.max(2, Number(row.orders) / peak * 100)}%` }} /></div><span className="w-8 text-right font-semibold">{Number(row.orders)}</span></div>)}</div> : <p className="mt-5 text-sm text-[#173B35]/60">No orders in this reporting period.</p>}</section><div className="mb-7 flex flex-wrap gap-3">{products.map((row) => <div key={row.status} className="rounded-xl border bg-white px-4 py-3 text-sm"><strong>{row._count}</strong> {row.status.toLowerCase()} products</div>)}</div><AdminTable columns={["Day", "Orders", "Order value"]} empty="No daily records in this period.">{daily.map((row) => <tr key={row.day}><td>{adminDate(`${row.day}T12:00:00+05:30`)}</td><td>{Number(row.orders)}</td><td>{inr(row.gross)}</td></tr>)}</AdminTable></main>;
}
