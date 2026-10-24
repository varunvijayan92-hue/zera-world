import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { InventoryQuickForm } from "@/components/management-forms";

export default async function InventoryPage() {
  await requireAuth();
  const [products, inventory] = await Promise.all([
    prisma.product.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.inventory.findMany({
      include: { product: true },
      orderBy: { lastUpdatedAt: "desc" },
      take: 20,
    }),
  ]);

  const totalAvailable = inventory.reduce((total, item) => total + item.availableQty, 0);
  const totalReserved = inventory.reduce((total, item) => total + item.reservedQty, 0);

  return (
    <section className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Inventory sync</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Inventory</h1>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">{totalAvailable} units available</span>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Available units</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totalAvailable}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Reserved units</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{totalReserved}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm text-slate-500">Inventory items</p>
          <p className="mt-3 text-3xl font-black text-slate-900">{inventory.length}</p>
        </div>
      </div>

      <InventoryQuickForm products={products} />

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">Product</th>
              <th className="px-4 py-3 font-semibold">Available</th>
              <th className="px-4 py-3 font-semibold">Reserved</th>
              <th className="px-4 py-3 font-semibold">Damaged</th>
              <th className="px-4 py-3 font-semibold">Safety stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {inventory.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{entry.product.name}</td>
                <td className="px-4 py-3 text-slate-600">{entry.availableQty}</td>
                <td className="px-4 py-3 text-slate-600">{entry.reservedQty}</td>
                <td className="px-4 py-3 text-slate-600">{entry.damagedQty}</td>
                <td className="px-4 py-3 text-slate-600">{entry.safetyStock}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
