import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { adminLandingPath } from "@/lib/admin-navigation";
import StoreAdminLogin from "@/components/admin-login-form";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (adminLandingPath(user?.role) === "/admin/dashboard") redirect("/admin/dashboard");
  return <div className="min-h-screen bg-[#F7F4ED] text-[#173B35]">
    <header className="border-b border-[#173B35]/10 bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5"><Link href="/admin/login" className="text-xl font-black">ZeraWorld Admin</Link><Link href="/" className="text-sm font-semibold">View website</Link></div></header>
    <StoreAdminLogin />
  </div>;
}
