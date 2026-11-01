import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function FulfillmentPage() {
  await requireStoreAdmin();
  const [orders, approvals, purchases] = await Promise.all([
    prisma.customerOrder.findMany({ where: { status: { in: ["CONFIRMED", "PROCESSING"] } }, orderBy: { createdAt: "asc" }, take: 100 }),
    prisma.supplierApprovalDecision.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.purchaseOrder.findMany({ include: { supplier: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Fulfillment" description="Confirmed orders, saved supplier reviews and purchase-order records." /><AdminNotice>Supplier ordering is not connected yet. This page shows saved records; opening it does not submit a purchase or dispatch an order.</AdminNotice><h2 className="mb-4 text-xl font-bold">Orders awaiting fulfillment</h2><AdminTable columns={["Order", "Customer", "Status", "Amount", "Placed"]} empty="No confirmed or processing orders awaiting fulfillment.">{orders.map((order) => <tr key={order.id}><td><Link className="font-semibold underline" href={`/admin/orders?order=${order.id}`}>{order.marketplaceOrderId}</Link></td><td>{order.customerName || "Guest"}</td><td><StateBadge value={order.status} /></td><td>{inr(order.totalAmount)}</td><td>{adminDate(order.createdAt)}</td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Supplier review decisions</h2><AdminTable columns={["Order", "Supplier", "Decision", "Reason", "Reviewed"]} empty="No supplier decisions have been recorded.">{approvals.map((entry) => <tr key={entry.id}><td>{entry.marketplaceOrderId}</td><td>{entry.supplierName}</td><td><StateBadge value={entry.status} /></td><td>{entry.decisionReason || "Not recorded"}</td><td>{adminDate(entry.reviewedAt)}</td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Purchase orders</h2><AdminTable columns={["Reference", "Supplier", "Status", "Amount"]} empty="No purchase orders recorded.">{purchases.map((entry) => <tr key={entry.id}><td>{entry.orderNumber}</td><td>{entry.supplier.companyName}</td><td><StateBadge value={entry.status} /></td><td>{inr(entry.totalAmount)}</td></tr>)}</AdminTable></main>;
}
