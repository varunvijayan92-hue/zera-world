import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr, groupCheckoutCustomers } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";

export default async function CustomersPage() {
  await requireStoreAdmin();
  const orders = await prisma.customerOrder.findMany({ select: { id: true, customerName: true, shippingAddress: true, createdAt: true, totalAmount: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  const customers = groupCheckoutCustomers(orders);
  const accounts = await prisma.user.findMany({ where: { role: "CUSTOMER" }, select: { id: true, fullName: true, email: true, phone: true, isActive: true, createdAt: true, _count: { select: { customerOrders: true, addresses: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Customers" description="Registered customer accounts and recorded checkout contacts." /><h2 className="mb-4 text-xl font-bold">Customer accounts</h2><AdminTable columns={["Name", "Email", "Phone", "Saved addresses", "Orders", "Status"]} empty="No registered customer accounts.">{accounts.map((account) => <tr key={account.id}><td>{account.fullName}</td><td>{account.email}</td><td>{account.phone}</td><td>{account._count.addresses}</td><td><Link className="underline" href={`/admin/orders?customerId=${account.id}`}>{account._count.customerOrders} orders</Link></td><td>{account.isActive ? "Active" : "Disabled"}</td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Checkout contacts</h2><AdminNotice>Contacts are grouped by email or phone from the latest 1,000 orders. This list includes both guest and account checkout contacts. Order value includes pending and cancelled orders.</AdminNotice><AdminTable columns={["Customer", "Email", "Phone", "Orders", "Order value", "Latest order"]} empty="Customer contacts will appear after orders are placed.">{customers.map((customer) => <tr key={customer.key}><td className="font-semibold">{customer.name}</td><td>{customer.email || "Not recorded"}</td><td>{customer.phone || "Not recorded"}</td><td>{customer.orderCount}</td><td>{inr(customer.orderValue)}</td><td>{adminDate(customer.lastOrder)}</td></tr>)}</AdminTable></main>;
}
