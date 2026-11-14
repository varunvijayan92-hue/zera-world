import type { MetadataRoute } from "next";

export function portalManifest(portal: "customer" | "admin" | "supplier"): MetadataRoute.Manifest {
  const scope = portal === "admin" ? "/admin/" : portal === "supplier" ? "/suppliers/" : "/";
  const name = portal === "customer" ? "Zera's World" : `Zera's World ${portal === "admin" ? "Admin" : "Supplier"}`;
  return {
    id: portal === "customer" ? "/" : scope,
    name, short_name: name,
    description: portal === "customer" ? "Home, kitchen and lifestyle essentials." : `${name} portal. Sign in to manage your account.`,
    start_url: scope, scope,
    display: "standalone", background_color: "#F7F4ED", theme_color: "#173B35",
    icons: [{ src: "/zerasworld-icon.png", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
