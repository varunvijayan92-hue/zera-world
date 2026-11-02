import type { Metadata, MetadataRoute } from "next";
import { categoryLink, visibleMenuCategories, type MenuCategory } from "./category";

export const SITE_URL = "https://zerasworld.in";
export const STORE_NAME = "Zera's World";
export const STORE_ALIASES = ["ZerasWorld", "Zeras World"];
export const STORE_DESCRIPTION = "Discover Zera's World: thoughtfully selected home, kitchen, travel, workspace and lifestyle essentials. Discover More. Live Better.";
export const publicPagePaths = ["/", "/products", "/categories", "/new-arrivals", "/about", "/contact", "/privacy", "/terms", "/shipping", "/returns"];
export const privatePagePaths = ["/admin", "/dashboard", "/supplier", "/suppliers", "/account", "/checkout", "/cart", "/login", "/forgot-password", "/track-order", "/api/"];
export const siteUrl = (path: string) => new URL(path, SITE_URL).toString();
export function publicPageMetadata(title: string, description: string, path: string): Metadata {
  return { title, description, alternates: { canonical: siteUrl(path) }, openGraph: { title: `${title} | ${STORE_NAME}`, description, url: siteUrl(path), siteName: STORE_NAME, type: "website", images: [{ url: siteUrl("/branding/zera-botanical-logo.png"), alt: STORE_NAME }] } };
}
type SitemapProduct = { id: string; status: string; updatedAt: Date; imageUrls: string[] };
export function buildStoreSitemap(categories: (MenuCategory & { updatedAt?: Date })[], products: SitemapProduct[]): MetadataRoute.Sitemap {
  return [
    ...publicPagePaths.map(path => ({ url: siteUrl(path) })),
    ...visibleMenuCategories(categories).map(category => ({ url: siteUrl(categoryLink(category.slug)), ...(category.updatedAt ? { lastModified: category.updatedAt } : {}) })),
    ...products.filter(product => product.status === "ACTIVE").map(product => ({ url: siteUrl(`/products/${encodeURIComponent(product.id)}`), lastModified: product.updatedAt, images: product.imageUrls.filter(url => url.startsWith("https://")) })),
  ];
}
export const storeStructuredData = {
  "@context": "https://schema.org", "@graph": [
    { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: STORE_NAME, alternateName: STORE_ALIASES, url: SITE_URL, description: STORE_DESCRIPTION, publisher: { "@id": `${SITE_URL}/#organization` } },
    { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: STORE_NAME, alternateName: STORE_ALIASES, url: SITE_URL, logo: siteUrl("/branding/zera-botanical-logo.png"), email: "support@zerasworld.in" },
  ],
};
