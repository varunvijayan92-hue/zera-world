import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { SupplierProductMappingForm } from "@/components/management-forms";

export default async function SupplierMappingsPage() {
  await requireAuth();

  const [products, suppliers, mappings] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.supplier.findMany({ orderBy: { companyName: "asc" } }),
    prisma.supplierProductMapping.findMany({
      include: { product: true, supplier: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Supplier mappings</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Product mapping</h1>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
          {mappings.length} mapped products
        </span>
      </div>

      <SupplierProductMappingForm products={products} suppliers={suppliers} />

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Internal product</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">Supplier SKU</th>
              <th className="px-4 py-3 font-semibold">Cost</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {mappings.map((mapping) => (
              <tr key={mapping.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{mapping.product?.name || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{mapping.supplier?.companyName || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{mapping.supplierSku || mapping.externalProductId || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{mapping.purchaseCost ? `₹${Number(mapping.purchaseCost).toLocaleString("en-IN")}` : "—"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    {mapping.mappingStatus || "ACTIVE"}
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
