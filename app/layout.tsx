import "./globals.css";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront-chrome";
import { CustomerAccountMenu } from "@/components/customer-account-menu";
import type { Metadata } from "next";

import { getBaseUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "Zera's World",
    template: "%s | Zera's World",
  },
  description: "Premium ecommerce and supplier-to-marketplace integration.",
  applicationName: "Zera's World",
  keywords: ["premium ecommerce", "supplier integration", "marketplace operations", "Zera's World Connect"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><StorefrontHeader />{children}<StorefrontFooter /><CustomerAccountMenu /></body>
    </html>
  );
}
