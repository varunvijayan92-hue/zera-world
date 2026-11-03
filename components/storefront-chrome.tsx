"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag, UserRound } from "lucide-react";
import ZeraWorldLogo from "./zera-logo";
import { footerNavigation, storefrontNavigation, isInternalPortal } from "@/lib/storefront-navigation";

export function StorefrontHeader() {
  const pathname = usePathname();
  if (isInternalPortal(pathname)) return null;

  return (
    <header className="border-b border-[#173B35]/10 bg-[#F7F4ED] text-[#173B35]">
      <div className="hidden bg-[#173B35] text-[#EAF3EE] md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-end gap-3 px-4 py-2 text-[11px] font-medium sm:px-6 lg:px-8">
          <div className="hidden items-center gap-5 text-[11px] md:flex">
            <Link href="/track-order" className="transition hover:text-white/85">Track Order</Link>
            <Link href="/contact" className="transition hover:text-white/85">Help &amp; Support</Link>
            <span>INR (₹)</span>
            <Link href="/account" className="font-semibold transition hover:text-white/85">
              Sign In / Register
            </Link>
          </div>
        </div>
      </div>

      <div className="border-b border-[#173B35]/10 bg-[#FAF9F5]">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Zera's World home" className="min-w-0">
            <ZeraWorldLogo compact />
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden items-center justify-center gap-6 text-sm font-semibold text-[#173B35]/80 lg:flex"
          >
            {storefrontNavigation.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`relative pb-1 transition hover:text-[#173B35] ${
                  pathname === link.href ? "text-[#173B35] after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-[#B38A45]" : ""
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link href="/account" aria-label="My account" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#173B35]/15 bg-white text-[#173B35] transition hover:bg-[#173B35]/5">
              <UserRound size={18} />
            </Link>
            <Link href="/cart" aria-label="Shopping cart" className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#173B35] text-white shadow-[0_10px_22px_rgba(23,59,53,0.2)] transition hover:bg-[#0f2a26]">
              <ShoppingBag size={18} />
            </Link>
          </div>
        </div>
        <nav aria-label="Mobile navigation" className="flex justify-center gap-4 overflow-x-auto border-t border-[#173B35]/10 px-3 text-xs font-semibold lg:hidden">{storefrontNavigation.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} className="flex min-h-11 shrink-0 items-center border-b-2 border-transparent aria-[current=page]:border-[#B38A45]">{link.label}</Link>)}</nav>
      </div>
    </header>
  );
}

export function StorefrontFooter() {
  const pathname = usePathname();
  if (isInternalPortal(pathname)) return null;
  return <footer className="border-t border-[#173B35]/10 bg-[#F0EDE4] px-5 py-10 text-[#173B35] md:px-8"><div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-[1fr_1.5fr]"><div><Link href="/" className="text-xl font-black">Zera&apos;s World</Link><p className="mt-3 text-sm font-semibold">Discover More. Live Better.</p><p className="mt-2 max-w-sm text-sm leading-relaxed text-[#173B35]/70">Practical, stylish and thoughtfully selected products for everyday living.</p></div><nav aria-label="Footer navigation" className="grid grid-cols-2 content-start gap-x-5 gap-y-4 text-sm">{footerNavigation.map((link) => <Link key={link.href} href={link.href} className="w-fit font-medium underline-offset-4 hover:underline">{link.label}</Link>)}</nav></div></footer>;
}
