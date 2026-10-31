import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function InvoicesPage() {
  await requireStoreAdmin();
  const orders = await prisma.customerOrder.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Invoices" description="Review and print order receipts from the latest 100 customer orders." /><AdminNotice>Order receipts are available below. Formal invoice numbering and business invoice details have not been configured.</AdminNotice><AdminTable columns={["Order reference", "Customer", "Order status", "Total", "Date", "Receipt"]} empty="Order receipts will appear when orders are placed.">{orders.map((order) => <tr key={order.id}><td className="font-semibold">{order.marketplaceOrderId}</td><td>{order.customerName || "Guest"}</td><td><StateBadge value={order.status} /></td><td>{inr(order.totalAmount)}</td><td>{adminDate(order.createdAt)}</td><td><Link href={`/admin/invoices/${order.id}`} className="font-semibold underline">View / print</Link></td></tr>)}</AdminTable></main>;
}
