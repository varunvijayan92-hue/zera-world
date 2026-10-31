import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { AdminShell } from "@/components/admin-shell";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default async function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const permitted = user?.role === "ADMIN" || user?.role === "MANAGER";
  if (user && permitted) return <AdminShell user={{ fullName: user.fullName, role: user.role }}>{children}</AdminShell>;
  return <div className="min-h-screen bg-[#F7F4ED] text-[#173B35]">
    <header className="border-b border-[#173B35]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/admin/dashboard" className="text-xl font-black">ZeraWorld Store admin</Link><Link href="/" className="text-sm font-semibold">View website</Link></div></header>
    {children}
  </div>;
}
