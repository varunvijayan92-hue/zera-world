"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, ShoppingBag, UserRound } from "lucide-react";
import ZeraWorldLogo from "./zera-logo";
import { footerNavigation, storefrontNavigation, isInternalPortal } from "@/lib/storefront-navigation";

export function StorefrontHeader() {
  const pathname = usePathname();
  if (isInternalPortal(pathname)) return null;
  return <header className="border-b border-[#173B35]/10 bg-[#FAF9F5] px-4 text-[#173B35] md:px-8"><div className="mx-auto max-w-7xl"><div className="flex min-h-20 items-center justify-between gap-3"><Link href="/" aria-label="Zera's World home" className="shrink-0"><ZeraWorldLogo compact /></Link><div className="flex items-center gap-1 sm:gap-3"><Link href="/products#catalog-search" aria-label="Search products" className="rounded-full p-3 hover:bg-[#173B35]/5 focus-visible:outline-offset-4"><Search size={19} /></Link><Link href="/account" aria-label="My account" className="rounded-full p-3 hover:bg-[#173B35]/5 focus-visible:outline-offset-4"><UserRound size={19} /></Link><Link href="/cart" aria-label="Shopping cart" className="rounded-full bg-[#173B35] p-3 text-white focus-visible:outline-offset-4"><ShoppingBag size={19} /></Link></div></div><nav aria-label="Main navigation" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-[#173B35]/10 py-4 text-sm font-semibold sm:gap-x-9">{storefrontNavigation.map((link) => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className={`underline-offset-8 hover:underline ${pathname === link.href ? "underline decoration-[#B38A45] decoration-2" : ""}`}>{link.label}</Link>)}</nav></div></header>;
}
export function StorefrontFooter() {
  const pathname = usePathname();
  if (isInternalPortal(pathname)) return null;
  return <footer className="border-t border-[#173B35]/10 bg-[#F0EDE4] px-5 py-10 text-[#173B35] md:px-8"><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_1.5fr]"><div><Link href="/" className="text-xl font-black">Zera&apos;s World</Link><p className="mt-3 text-sm font-semibold">Discover More. Live Better.</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#173B35]/70">Practical, stylish and thoughtfully selected products for everyday living.</p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 content-start gap-x-5 gap-y-4 text-sm">{footerNavigation.map((link) => <Link key={link.href} href={link.href} className="w-fit font-medium underline-offset-4 hover:underline">{link.label}</Link>)}</nav></div></footer>;
}
