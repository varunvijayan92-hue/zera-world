"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { supplierNavigation } from "@/lib/supplier-navigation";
import { AdminSignOut } from "./admin-sign-out";
import ZeraWorldLogo from "./zera-logo";

export function SupplierShell({ companyName, section, notificationCount, children }: { companyName: string; section: string; notificationCount: number; children: ReactNode }) {
  const [open, setOpen] = useState(false); const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = toggle.current, previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(document.getElementById("supplier-sidebar")?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') || []);
    controls()[0]?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab") {
        const items = controls(), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown", keyboard); opener?.focus(); };
  }, [open]);
  return <div className="min-h-screen bg-[#F7F4ED] text-[#173B35] lg:flex">
    <header className="flex items-center gap-3 border-b bg-white p-4 lg:hidden"><button ref={toggle} type="button" aria-label="Open supplier navigation" aria-expanded={open} aria-controls="supplier-sidebar" onClick={() => setOpen(true)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"><Menu size={21} /></button><div className="min-w-0"><Link href="/suppliers/dashboard" aria-label="Zera's World supplier dashboard"><ZeraWorldLogo compact className="!w-[140px]" /></Link><p className="font-bold">Supplier portal</p><p className="break-words text-xs">{companyName}</p></div></header>
    {open ? <button type="button" aria-label="Close supplier navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" /> : null}
    <aside id="supplier-sidebar" className={`fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] shrink-0 overflow-y-auto border-r bg-white p-5 transition-transform lg:sticky lg:top-0 lg:h-screen lg:visible lg:translate-x-0 ${open ? "visible translate-x-0" : "invisible -translate-x-full"}`}>
      <div className="flex items-center justify-between gap-2"><Link href="/suppliers/dashboard" onClick={() => setOpen(false)} aria-label="Zera's World supplier dashboard"><ZeraWorldLogo compact className="!w-[155px]" /></Link><button type="button" aria-label="Close supplier navigation" onClick={() => setOpen(false)} className="rounded-lg p-2 lg:hidden"><X size={20} /></button></div>
      <p className="mb-5 mt-2 text-xs uppercase tracking-widest">Supplier portal</p><p className="mb-5 break-words text-sm font-semibold">{companyName}</p>
      <nav aria-label="Supplier navigation" className="space-y-5">{supplierNavigation.map(([group, entries]) => <section key={group}><h2 className="mb-2 text-xs uppercase opacity-50">{group}</h2>{entries.map(([label, slug]) => <Link key={slug} href={`/suppliers/${slug}`} prefetch={false} onClick={() => setOpen(false)} aria-current={section === slug ? "page" : undefined} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${section === slug ? "bg-[#173B35] text-white" : "hover:bg-[#F7F4ED]"}`}><span>{label}</span>{slug === "notifications" && notificationCount > 0 ? <span className="rounded-full bg-[#173B35]/10 px-2 py-0.5 text-[10px] font-bold">{notificationCount}</span> : null}</Link>)}</section>)}</nav>
      <div className="mt-6"><AdminSignOut redirectTo="/suppliers/login" /></div>
    </aside>{children}
  </div>;
}
