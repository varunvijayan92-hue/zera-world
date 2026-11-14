import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { adminLandingPath } from "@/lib/admin-navigation";
import StoreAdminLogin from "@/components/admin-login-form";
import ZeraWorldLogo from "@/components/zera-logo";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (adminLandingPath(user?.role) === "/admin/dashboard") redirect("/admin/dashboard");
  return <div className="min-h-screen bg-[#F7F4ED] text-[#173B35]">
    <header className="border-b border-[#173B35]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-5"><Link href="/admin/login" aria-label="Zera's World admin login" className="flex min-w-0 items-center gap-2"><ZeraWorldLogo compact className="!w-[145px]" /><span className="text-xs font-semibold uppercase tracking-widest">Admin</span></Link><Link href="/" className="shrink-0 text-sm font-semibold">View website</Link></div></header>
    <StoreAdminLogin />
    <p className="pb-8 text-center text-sm"><Link href="/app" className="underline">Admin and supplier app sign in</Link></p>
  </div>;
}
