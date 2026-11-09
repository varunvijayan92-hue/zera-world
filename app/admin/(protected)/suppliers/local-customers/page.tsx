import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { SupplierAdminNavigation } from "@/components/supplier-admin-navigation";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";

export default async function LocalCustomersAdminPage() {
  await requireStoreAdmin();
  const customers = await prisma.supplierLocalCustomer.findMany({ include: { supplier: { select: { companyName: true } } }, orderBy: { createdAt: "desc" }, take: 500 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Supplier local customers" description="Offline contacts recorded by suppliers." /><SupplierAdminNavigation /><AdminNotice>These are supplier-managed contact records. They do not create customer logins, website orders, payments or sales.</AdminNotice><AdminTable columns={["Supplier", "Customer", "Phone", "Email", "Address", "Notes"]} empty="No supplier local customers have been added.">{customers.map(customer => <tr key={customer.id}><td>{customer.supplier.companyName}</td><td>{customer.name}</td><td>{customer.phone || "—"}</td><td className="break-all">{customer.email || "—"}</td><td className="break-words">{customer.address || "—"}</td><td className="break-words">{customer.notes || "—"}</td></tr>)}</AdminTable><p className="mt-3 text-xs">Showing the latest 500 records.</p></main>;
}
