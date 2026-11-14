import { portalManifest } from "@/lib/portal-manifest";
export function GET() {
  return Response.json(portalManifest("admin"), { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "no-store" } });
}
