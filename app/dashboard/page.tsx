import { ArrowUpRight, Boxes, CircleDollarSign, PackageCheck, Settings, ShieldCheck, ShoppingCart, Truck, Warehouse } from "lucide-react";
import Link from "next/link";

import { getCurrentUser, requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

  const summary = [
    { label: "Suppliers", value: "128", trend: "Active partners", icon: Boxes },
    { label: "Products", value: "4,820", trend: "Catalog tracked", icon: PackageCheck },
    { label: "Orders", value: "1,432", trend: "Awaiting dispatch", icon: Truck },
    { label: "Margin", value: "₹4.82L", trend: "Estimated net", icon: CircleDollarSign },
  ];

  return (
    <main className="min-h-screen bg-[#F7F4ED]">
      <div className="mx-auto max-w-7xl p-4 md:p-6">
        <header className="rounded-[28px] border border-[#173B35]/10 bg-white px-5 py-4 shadow-[0_10px_28px_rgba(23,59,53,0.04)] md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#173B35]/55">Operations</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.07em] text-[#173B35]">Dashboard</h1>
            </div>

            <div className="flex items-center gap-3">
              <span className="rounded-full border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-1 text-sm font-medium text-[#173B35]">
                {user.role}
              </span>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-4 py-2 text-sm font-semibold text-[#173B35]"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {summary.map(({ label, value, trend, icon: Icon }) => (
            <div key={label} className="rounded-2xl border border-[#173B35]/10 bg-white p-5 shadow-[0_8px_22px_rgba(23,59,53,0.03)]">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#173B35]/60">{label}</span>
                <span className="rounded-xl bg-[#F7F4ED] p-2 text-[#173B35]">
                  <Icon size={16} />
                </span>
              </div>

              <div className="mt-4">
                <p className="text-3xl font-black tracking-[-0.05em] text-[#173B35]">{value}</p>
                <p className="mt-2 text-sm text-[#173B35]/65">{trend}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,59,53,0.04)] md:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-[#173B35]">Operations snapshot</h2>
              <span className="rounded-full bg-[#8EA695]/15 px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[#173B35]">
                Live
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {[
                { label: "Amazon orders", value: "42 ready", tone: "bg-[#F7F4ED] text-[#173B35]" },
                { label: "Supplier dispatch", value: "18 queued", tone: "bg-[#EAF0EB] text-[#173B35]" },
                { label: "Inventory sync", value: "Healthy", tone: "bg-[#EEF5EC] text-[#173B35]" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] px-4 py-3">
                  <span className="font-medium text-[#173B35]">{item.label}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.tone}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,59,53,0.04)] md:p-6">
            <h2 className="text-xl font-bold text-[#173B35]">Quick actions</h2>
            <div className="mt-5 space-y-2.5">
              {[
                { label: "Review orders", href: "/dashboard/orders" },
                { label: "Suppliers", href: "/dashboard/suppliers" },
                { label: "Product catalog", href: "/dashboard/products" },
                { label: "Mappings", href: "/dashboard/mappings" },
                { label: "Payments", href: "/dashboard/payments" },
              ].map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="block rounded-xl border border-[#173B35]/10 bg-[#F7F4ED] px-4 py-3 text-sm font-medium text-[#173B35] transition hover:border-[#173B35]/20"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
