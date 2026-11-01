import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminStat, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function DashboardPage() {
  await requireStoreAdmin();
  const [products, orders, suppliers, shipments, approvals, captured, latest] = await Promise.all([
    prisma.product.count(), prisma.customerOrder.count(), prisma.supplier.count(),
    prisma.shipment.count({ where: { status: { not: "DELIVERED" } } }),
    prisma.supplierApprovalDecision.count({ where: { status: "PENDING" } }),
    prisma.paymentTransaction.aggregate({ where: { paymentStatus: "PAID" }, _sum: { amount: true } }),
    prisma.customerOrder.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Dashboard" description="An overview of your saved store, order and payment records."><Link href="/admin/products" className="rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">Manage products</Link></AdminHeading><div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><AdminStat label="Products" value={products} href="/admin/products" /><AdminStat label="Orders" value={orders} href="/admin/orders" /><AdminStat label="Captured payments" value={inr(captured._sum.amount)} detail="Recorded PAID transactions; excludes refund reconciliation." href="/admin/payments" /><AdminStat label="Suppliers" value={suppliers} href="/admin/suppliers" /><AdminStat label="Open shipments" value={shipments} href="/admin/tracking" /><AdminStat label="Awaiting supplier review" value={approvals} href="/admin/fulfillment" /></div><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold">Recent orders</h2><Link href="/admin/orders" className="text-sm font-semibold underline">View all orders</Link></div><AdminTable columns={["Order", "Customer", "Status", "Amount", "Date"]} empty="Customer orders will appear here after checkout.">{latest.map((order) => <tr key={order.id}><td><Link href={`/admin/orders?order=${order.id}`} className="font-semibold underline">{order.marketplaceOrderId}</Link></td><td>{order.customerName || "Guest"}</td><td><StateBadge value={order.status} /></td><td>{inr(order.totalAmount)}</td><td>{adminDate(order.createdAt)}</td></tr>)}</AdminTable></main>;
}
