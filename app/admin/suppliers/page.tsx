import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";
import { SupplierForm } from "@/components/admin-record-forms";

export default async function SuppliersPage() {
  await requireStoreAdmin();
  const suppliers = await prisma.supplier.findMany({ include: { _count: { select: { products: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Suppliers" description="Supplier contacts, platform records and assigned product counts." /><AdminNotice>Adding a supplier saves its details. Live catalog, stock and order automation still require that supplier&apos;s API connector and credentials.</AdminNotice><SupplierForm /><AdminTable columns={["Supplier", "Contact", "Country", "Integration", "Stored connection", "Products", "Status"]} empty="Add your first supplier above.">{suppliers.map((supplier) => <tr key={supplier.id}><td><p className="font-semibold">{supplier.companyName}</p><p className="mt-1 text-xs text-[#173B35]/55">{supplier.provider || "Provider not set"}</p></td><td><p>{supplier.contactName || "Not recorded"}</p><p className="mt-1 text-xs">{supplier.email || supplier.phone || ""}</p></td><td>{supplier.country || "Not recorded"}</td><td>{supplier.integrationType || "MANUAL"}</td><td><StateBadge value={supplier.connectionStatus} /></td><td>{supplier._count.products}</td><td><StateBadge value={supplier.status} /></td></tr>)}</AdminTable></main>;
}
