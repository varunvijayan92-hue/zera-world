export const dynamic = "force-dynamic";
export const metadata = { manifest: "/admin/manifest.webmanifest", robots: { index: false, follow: false } };

export default function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
