import Link from "next/link";
import { AppPortalLogin } from "@/components/app-portal-login";
import ZeraWorldLogo from "@/components/zera-logo";

export default function AppLoginPage() {
  return <main className="min-h-screen bg-[#F7F4ED] px-5 py-10 text-[#173B35]"><div className="mx-auto max-w-md"><Link href="/" aria-label="Zera's World"><ZeraWorldLogo compact className="!w-[145px]" /></Link></div><div className="mt-8"><AppPortalLogin /></div></main>;
}
