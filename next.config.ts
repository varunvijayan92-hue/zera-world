import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const configuredUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
const canonicalHost = configuredUrl ? (() => {
  try {
    return new URL(configuredUrl).hostname;
  } catch {
    return undefined;
  }
})() : undefined;
const canonicalRedirect = canonicalHost && canonicalHost !== "localhost" && canonicalHost !== "127.0.0.1"
  ? {
      source: "/:path*",
      has: [{ type: "host", key: "host", value: `www.${canonicalHost}` }],
      destination: `https://${canonicalHost}/:path*`,
      permanent: true,
    }
  : null;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async redirects() {
    return canonicalRedirect ? [canonicalRedirect] : [];
  },
  async headers() {
    if (!isProduction) {
      return [];
    }

    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
