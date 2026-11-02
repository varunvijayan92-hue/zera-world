import type { MetadataRoute } from "next";
import { STORE_DESCRIPTION } from "@/lib/seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zera's World",
    short_name: "Zera's World",
    description: STORE_DESCRIPTION,
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
