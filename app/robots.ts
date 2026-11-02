import type { MetadataRoute } from "next";
import { privatePagePaths, siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: privatePagePaths }, sitemap: siteUrl("/sitemap.xml"), host: siteUrl("/") };
}
