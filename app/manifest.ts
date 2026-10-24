import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ZeraWorld",
    short_name: "ZeraWorld",
    description: "Premium ecommerce and supplier-to-marketplace integration.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F4ED",
    theme_color: "#173B35",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/favicon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
  };
}
