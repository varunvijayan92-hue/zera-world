import { getMarketplaceOverview } from "@/lib/marketplace";
import { requireAuth } from "@/lib/auth";

export default async function MarketplacesPage() {
  await requireAuth();
  const marketplaces = getMarketplaceOverview();

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Integration settings</p>
          <h1 className="mt-2 text-3xl font-black text-slate-900">Marketplace connections</h1>
        </div>
        <button className="rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white">Add connection</button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {marketplaces.map((marketplace) => (
          <div key={marketplace.type} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-bold text-slate-900">{marketplace.name}</h2>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  marketplace.isConnected ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                }`}
              >
                {marketplace.status}
              </span>
            </div>

            <p className="mt-4 text-sm text-slate-600">{marketplace.message}</p>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
              <span>Last sync</span>
              <span>{marketplace.lastSync}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
