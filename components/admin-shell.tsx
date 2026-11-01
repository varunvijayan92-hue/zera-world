"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LayoutDashboard, ChartNoAxesCombined, Package, ShoppingCart, Users, Warehouse, Tags, Truck, PackageCheck, RefreshCw, MapPin, CreditCard, Receipt, CircleDollarSign, Settings, ShieldCheck, Menu, X, ExternalLink, type LucideIcon } from "lucide-react";
import { adminNavigation, isAdminNavActive } from "@/lib/admin-navigation";
import { AdminSignOut } from "./admin-sign-out";

const icons: Record<string, LucideIcon> = { dashboard: LayoutDashboard, analytics: ChartNoAxesCombined, products: Package, orders: ShoppingCart, customers: Users, inventory: Warehouse, categories: Tags, suppliers: Truck, fulfillment: PackageCheck, sync: RefreshCw, tracking: MapPin, payments: CreditCard, invoices: Receipt, profit: CircleDollarSign, settings: Settings, users: ShieldCheck };

export function AdminShell({ user, children }: { user: { fullName: string; role: string }; children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = toggle.current;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = document.getElementById("admin-sidebar");
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
    controls()[0]?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const items = controls(); const first = items[0]; const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", close); opener?.focus(); };
  }, [open]);
  return <div className="min-h-screen bg-[#F7F4ED] text-[#173B35] lg:flex">
    {open ? <button type="button" aria-label="Close navigation overlay" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} /> : null}
    <aside id="admin-sidebar" className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-[#173B35]/10 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 print:hidden ${open ? "visible translate-x-0" : "invisible -translate-x-full lg:visible"}`}>
      <div className="flex h-16 items-center justify-between border-b border-[#173B35]/10 px-6"><Link href="/admin/dashboard" onClick={() => setOpen(false)} className="text-xl font-black tracking-tight">ZeraWorld <span className="text-xs font-semibold uppercase tracking-widest text-[#173B35]/50">Admin</span></Link><button type="button" onClick={() => setOpen(false)} aria-label="Close admin navigation" className="rounded-lg p-2 lg:hidden"><X size={19} /></button></div>
      <nav aria-label="Admin navigation" className="space-y-3 px-3 py-4">{adminNavigation.map((group) => <section key={group.label}><h2 className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#173B35]/45">{group.label}</h2><ul className="space-y-0.5">{group.items.map((item) => {
        const Icon = icons[item.icon]; const active = isAdminNavActive(pathname, item.href);
        return <li key={item.href}><Link href={item.href} prefetch={false} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-1.5 text-[13px] transition ${active ? "bg-[#173B35] font-semibold text-white" : "text-[#173B35]/75 hover:bg-[#F7F4ED] hover:text-[#173B35]"}`}><span className="flex items-center gap-3"><Icon size={17} className="shrink-0" />{item.label}</span>{item.badge ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-white/15 text-white" : "bg-[#173B35]/10 text-[#173B35]"}`}>{item.badge}</span> : null}</Link></li>;
      })}</ul></section>)}</nav>
    </aside>
    <div className="min-w-0 flex-1"><header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-[#173B35]/10 bg-white px-4 py-4 md:px-7 print:hidden"><div className="flex items-center gap-3"><button ref={toggle} type="button" aria-label="Open admin navigation" aria-expanded={open} aria-controls="admin-sidebar" onClick={() => setOpen(true)} className="rounded-lg border border-[#173B35]/15 p-2 lg:hidden"><Menu size={20} /></button><div><p className="text-sm font-bold">Store administration</p><p className="mt-1 text-xs text-[#173B35]/55">{user.fullName} · {user.role.toLowerCase()}</p></div></div><div className="flex items-center gap-5"><Link href="/" target="_blank" className="inline-flex items-center gap-1.5 text-sm font-semibold"><ExternalLink size={15} /> View website</Link><AdminSignOut /></div></header><div className="min-w-0">{children}</div></div>
  </div>;
}
