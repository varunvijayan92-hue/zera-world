import "./globals.css";
import type { Metadata } from "next";

import { getBaseUrl } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: "ZeraWorld",
    template: "%s | ZeraWorld",
  },
  description: "Premium ecommerce and supplier-to-marketplace integration.",
  applicationName: "ZeraWorld",
  keywords: ["premium ecommerce", "supplier integration", "marketplace operations", "ZeraWorld Connect"],
  icons: {
    icon: "/icon.svg",
    shortcut: "/favicon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
