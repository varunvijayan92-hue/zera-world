import Link from "next/link";
import { Boxes, CircleDollarSign, PackageCheck, Settings, ShieldCheck, ShoppingCart, Truck, Warehouse } from "lucide-react";

import ZeraWorldLogo from "@/components/zera-logo";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const groupedNavItems = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: ShieldCheck },
    ],
  },
  {
    title: "Catalog",
    items: [
      { href: "/dashboard/suppliers", label: "Suppliers", icon: Warehouse },
      { href: "/dashboard/products", label: "Product Catalog", icon: Boxes },
      { href: "/dashboard/mappings", label: "Supplier Mappings", icon: PackageCheck },
      { href: "/dashboard/inventory", label: "Inventory", icon: PackageCheck },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: ShoppingCart },
      { href: "/dashboard/payments", label: "Payments", icon: CircleDollarSign },
      { href: "/dashboard/reports", label: "Reports", icon: CircleDollarSign },
    ],
  },
  {
    title: "Integrations",
    items: [
      { href: "/dashboard/marketplaces", label: "Marketplaces", icon: Truck },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen bg-[#F7F4ED] text-[#173B35]">
      <div className="mx-auto flex max-w-[1600px] gap-6 p-4 lg:p-6">
        <aside className="hidden w-72 shrink-0 rounded-[28px] bg-[#173B35] p-5 text-white shadow-[0_18px_48px_rgba(23,59,53,0.18)] lg:block">
          <div className="flex items-center gap-3 border-b border-white/10 pb-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#B38A45] text-lg font-black text-[#173B35]">
              <ZeraWorldLogo compact variant="light" />
            </div>
            <div>
              <p className="text-lg font-bold">ZeraWorld</p>
              <p className="text-xs text-[#F7F4ED]/70">Connect</p>
            </div>
          </div>

          <nav className="mt-6 space-y-5">
            {groupedNavItems.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="px-2 text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[#F7F4ED]/45">
                  {group.title}
                </p>
                {group.items.map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#F7F4ED]/75 transition hover:bg-white/5 hover:text-white"
                  >
                    <Icon size={16} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-[#F7F4ED]/60">Signed in</p>
            <p className="mt-2 text-sm font-semibold text-white">{user?.fullName || "Admin"}</p>
            <p className="text-xs text-[#F7F4ED]/60">{user?.role || "ADMIN"}</p>
          </div>
        </aside>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
