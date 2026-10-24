import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ProductQuickForm } from "@/components/management-forms";

export default async function ProductsPage() {
  await requireAuth();
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({ orderBy: { companyName: "asc" } }),
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true },
      take: 20,
    }),
  ]);

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Product catalogue</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Products</h1>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">{products.length} items in catalog</span>
      </div>

      <ProductQuickForm suppliers={suppliers} />

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">SKU</th>
              <th className="px-4 py-3 font-semibold">Supplier</th>
              <th className="px-4 py-3 font-semibold">MRP</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {products.map((product) => (
              <tr key={product.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                <td className="px-4 py-3 text-slate-600">{product.sku}</td>
                <td className="px-4 py-3 text-slate-600">{product.supplier?.companyName || "—"}</td>
                <td className="px-4 py-3 text-slate-600">₹{product.sellingPrice?.toString() || "0"}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700">
                    {product.status}
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
