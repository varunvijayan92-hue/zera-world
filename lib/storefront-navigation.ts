export const storefrontNavigation = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/products" },
  { label: "Categories", href: "/categories" },
  { label: "New Arrivals", href: "/new-arrivals" },
] as const;
export const footerNavigation = [
  { label: "About Us", href: "/about" },
  { label: "Contact Us", href: "/contact" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms & Conditions", href: "/terms" },
  { label: "Shipping Policy", href: "/shipping" },
  { label: "Return & Refund Policy", href: "/returns" },
  { label: "Track Order", href: "/track-order" },
] as const;
export function isInternalPortal(pathname: string) {
  return ["/admin", "/supplier", "/suppliers", "/dashboard"].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
