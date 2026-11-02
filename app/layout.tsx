import "./globals.css";
import { StorefrontHeader, StorefrontFooter } from "@/components/storefront-chrome";
import { CustomerAccountMenu } from "@/components/customer-account-menu";
import type { Metadata } from "next";

import { SITE_URL, STORE_DESCRIPTION, STORE_ALIASES, storeStructuredData } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Zera's World | Home, Kitchen & Lifestyle Essentials",
    template: "%s | Zera's World",
  },
  description: STORE_DESCRIPTION,
  applicationName: "Zera's World",
  keywords: ["Zera's World", ...STORE_ALIASES, "home essentials", "kitchen essentials", "lifestyle products India"],
  openGraph: { title: "Zera's World", description: STORE_DESCRIPTION, siteName: "Zera's World", type: "website", locale: "en_IN", images: [{ url: "/branding/zera-botanical-logo.png", alt: "Zera's World" }] },
  twitter: { card: "summary_large_image", title: "Zera's World", description: STORE_DESCRIPTION, images: ["/branding/zera-botanical-logo.png"] },
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION || undefined, ...(process.env.BING_SITE_VERIFICATION ? { other: { "msvalidate.01": process.env.BING_SITE_VERIFICATION } } : {}) },
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(storeStructuredData).replace(/</g, "\\u003c") }} /><StorefrontHeader />{children}<StorefrontFooter /><CustomerAccountMenu /></body>
    </html>
  );
}
