import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr, groupCheckoutCustomers } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";

export default async function CustomersPage() {
  await requireStoreAdmin();
  const orders = await prisma.customerOrder.findMany({ select: { id: true, customerName: true, shippingAddress: true, createdAt: true, totalAmount: true }, orderBy: { createdAt: "desc" }, take: 1000 });
  const customers = groupCheckoutCustomers(orders);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Customers" description="Customer contacts and order history recorded during guest checkout." /><AdminNotice>Contacts are grouped by email or phone from the latest 1,000 orders. These are checkout contacts, not registered customer accounts. Order value includes pending and cancelled orders.</AdminNotice><AdminTable columns={["Customer", "Email", "Phone", "Orders", "Order value", "Latest order"]} empty="Customer contacts will appear after orders are placed.">{customers.map((customer) => <tr key={customer.key}><td className="font-semibold">{customer.name}</td><td>{customer.email || "Not recorded"}</td><td>{customer.phone || "Not recorded"}</td><td>{customer.orderCount}</td><td>{inr(customer.orderValue)}</td><td>{adminDate(customer.lastOrder)}</td></tr>)}</AdminTable></main>;
}
