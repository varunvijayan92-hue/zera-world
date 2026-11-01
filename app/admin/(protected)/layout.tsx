import { AdminShell } from "@/components/admin-shell";
import { requireStoreAdmin } from "@/lib/admin-page";

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStoreAdmin();
  return <AdminShell user={{ fullName: user.fullName, role: user.role }}>{children}</AdminShell>;
}
