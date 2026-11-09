import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { CjIntegrationForm } from "@/components/cj-integration-form";
import { SupplierAdminNavigation } from "@/components/supplier-admin-navigation";
import { AdminHeading } from "@/components/admin-ui";

export default async function CjSupplierPage() {
  const user = await requireStoreAdmin();
  const saved = await prisma.integrationSetting.findUnique({ where: { provider: "CJ_DROPSHIPPING" }, select: { id: true } });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="CJ API settings" description="Manage the store's CJdropshipping connection." /><SupplierAdminNavigation /><div className="max-w-2xl"><CjIntegrationForm saved={!!saved} canEdit={user.role === "ADMIN"} /></div></main>;
}
