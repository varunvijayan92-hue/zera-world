"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { AdminSignOut } from "./admin-sign-out";
export function CustomerAccountMenu() {
  const [user, setUser] = useState<{ fullName: string; role: string } | null>(null); const [open, setOpen] = useState(false); const path = usePathname();
  useEffect(() => { setOpen(false); if (!path.startsWith("/admin") && !path.startsWith("/supplier")) fetch("/api/auth/me").then((response) => response.json()).then((data) => setUser(data.user)).catch(() => setUser(null)); }, [path]);
  if (path.startsWith("/admin") || path.startsWith("/supplier") || user?.role !== "CUSTOMER") return null;
  return <div className="fixed bottom-5 right-5 z-30 text-[#173B35] print:hidden">{open ? <div className="mb-3 w-64 rounded-2xl border bg-white p-5 shadow-xl"><strong>{user.fullName}</strong><Link href="/account" className="my-3 block text-sm underline">Orders, addresses & profile</Link><Link href="/track-order" className="mb-4 block text-sm underline">Track an order</Link><AdminSignOut redirectTo="/login" /></div> : null}<button aria-label="Open customer account" aria-expanded={open} onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }} className="ml-auto flex h-12 w-12 items-center justify-center rounded-full border border-white bg-[#173B35] text-white shadow-lg"><UserRound size={22} /></button></div>;
}
