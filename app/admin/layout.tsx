export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };

export default function StoreAdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
