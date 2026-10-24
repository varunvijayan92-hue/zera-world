import { ArrowUpRight, Boxes, CircleDollarSign, PackageCheck, Settings, ShieldCheck, ShoppingCart, Truck, Warehouse } from "lucide-react";
import Link from "next/link";

import { getCurrentUser, requireAuth } from "@/lib/auth";

export default async function DashboardPage() {
  const user = await requireAuth();

  const summary = [
    { label: "Suppliers", value: "128", trend: "Active partner base", icon: Boxes },
    { label: "Products", value: "4,820", trend: "Catalog tracked", icon: PackageCheck },
    { label: "Amazon orders", value: "1,432", trend: "Awaiting dispatch", icon: Truck },
    { label: "Net margin", value: "₹4.82L", trend: "Estimated margin", icon: CircleDollarSign },
  ];

  return (
    <main className="min-h-screen bg-[#F7F4ED]">
      <div className="mx-auto flex min-h-screen max-w-7xl gap-6 p-6">
        <aside className="w-72 rounded-[30px] border border-[#173B35]/10 bg-[#173B35] p-5 text-white shadow-[0_18px_48px_rgba(23,59,53,0.18)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B38A45] text-lg font-black text-[#173B35]">
              ZW
            </div>
            <div>
              <p className="text-lg font-bold">ZeraWorld</p>
              <p className="text-xs text-[#F7F4ED]/70">Connect</p>
            </div>
          </div>

          <nav className="mt-8 space-y-5 text-sm">
            {[
              {
                title: "Overview",
                items: [{ label: "Dashboard", href: "/dashboard", icon: ShieldCheck }],
              },
              {
                title: "Catalog",
                items: [
                  { label: "Suppliers", href: "/dashboard/suppliers", icon: Warehouse },
                  { label: "Product Catalog", href: "/dashboard/products", icon: Boxes },
                  { label: "Supplier Mappings", href: "/dashboard/mappings", icon: PackageCheck },
                  { label: "Inventory", href: "/dashboard/inventory", icon: PackageCheck },
                ],
              },
              {
                title: "Operations",
                items: [
                  { label: "Orders", href: "/dashboard/orders", icon: ShoppingCart },
                  { label: "Payments", href: "/dashboard/payments", icon: CircleDollarSign },
                  { label: "Reports", href: "/dashboard/reports", icon: CircleDollarSign },
                ],
              },
              {
                title: "Integrations",
                items: [{ label: "Marketplaces", href: "/dashboard/marketplaces", icon: Truck }],
              },
              {
                title: "Administration",
                items: [{ label: "Settings", href: "/dashboard/settings", icon: Settings }],
              },
            ].map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="px-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[#F7F4ED]/45">
                  {group.title}
                </p>
                {group.items.map(({ label, href, icon: Icon }, index) => (
                  <Link
                    key={label}
                    href={href}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left ${
                      index === 0 && group.title === "Overview" ? "bg-white/10 text-white" : "text-[#F7F4ED]/75 hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon size={14} />
                      <span>{label}</span>
                    </span>
                    <ArrowUpRight size={14} />
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm text-[#F7F4ED]/80">
              <ShieldCheck size={16} className="text-[#B38A45]" />
              Secure session
            </div>
            <p className="mt-3 text-xs text-[#F7F4ED]/65">Role: {user.role}</p>
          </div>
        </aside>

        <div className="flex-1">
          <header className="rounded-[30px] border border-[#173B35]/10 bg-white px-6 py-4 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-[#173B35]/60">Welcome back</p>
                <h1 className="text-3xl font-black tracking-[-0.06em] text-[#173B35]">{user.fullName}</h1>
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
              <div key={label} className="rounded-2xl border border-[#173B35]/10 bg-white p-5 shadow-[0_10px_28px_rgba(23,59,53,0.03)]">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#173B35]/60">{label}</span>
                  <span className="rounded-xl bg-[#F7F4ED] p-2 text-[#173B35]">
                    <Icon size={16} />
                  </span>
                </div>
                <div className="mt-5">
                  <p className="text-3xl font-black tracking-[-0.05em] text-[#173B35]">{value}</p>
                  <p className="mt-2 text-sm font-medium text-[#173B35]/70">{trend}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
            <div className="rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#173B35]">Amazon-to-supplier workflow</h2>
                <span className="rounded-full bg-[#8EA695]/15 px-2.5 py-1 text-xs font-semibold text-[#173B35]">
                  Live queue
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  { platform: "Amazon orders", status: "Ready", detail: "New orders waiting for supplier action" },
                  { platform: "Supplier dispatch", status: "Queued", detail: "Ready to send fulfillment instructions" },
                  { platform: "Inventory sync", status: "Healthy", detail: "Stock checks before dispatch" },
                ].map((item) => (
                  <div key={item.platform} className="flex items-center justify-between rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
                    <div>
                      <p className="font-semibold text-[#173B35]">{item.platform}</p>
                      <p className="text-sm text-[#173B35]/65">{item.detail}</p>
                    </div>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[#173B35]">
                      {item.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
              <h2 className="text-xl font-bold text-[#173B35]">Quick actions</h2>
              <div className="mt-5 space-y-3">
                {[
                  { label: "Review Amazon orders", href: "/dashboard/orders" },
                  { label: "Add supplier", href: "/dashboard/suppliers" },
                  { label: "Manage product catalog", href: "/dashboard/products" },
                  { label: "Manage mappings", href: "/dashboard/mappings" },
                  { label: "Payment operations", href: "/dashboard/payments" },
                  { label: "Manage inventory", href: "/dashboard/inventory" },
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
      </div>
    </main>
  );
}
