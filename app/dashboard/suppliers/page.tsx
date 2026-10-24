import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { SupplierQuickForm } from "@/components/management-forms";

export default async function SuppliersPage() {
  await requireAuth();
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  const activeSupplierCount = suppliers.filter((supplier) => supplier.status === "ACTIVE").length;

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Supplier management</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Suppliers</h1>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{activeSupplierCount} active records</span>
      </div>

      <SupplierQuickForm />

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Company</th>
              <th className="px-4 py-3 font-semibold">Contact</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Integration</th>
              <th className="px-4 py-3 font-semibold">Connection</th>
              <th className="px-4 py-3 font-semibold">Auto order</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {suppliers.map((supplier) => (
              <tr key={supplier.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{supplier.companyName}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.contactName || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.provider || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.integrationType || "MANUAL"}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.connectionStatus || "PENDING"}</td>
                <td className="px-4 py-3 text-slate-600">{supplier.autoOrderProcessing ? "Enabled" : "Disabled"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                    {supplier.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
