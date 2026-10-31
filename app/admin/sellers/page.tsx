import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { IntegrationForm } from "@/components/integration-form";
import { AdminHeading, AdminNotice } from "@/components/admin-ui";
export default async function SellersPage() {
  const user = await requireStoreAdmin();
  const saved = await prisma.integrationSetting.findMany({ where: { provider: { in: ["AMAZON", "FLIPKART"] } }, select: { provider: true } });
  return <main className="mx-auto max-w-6xl p-5 md:p-8"><AdminHeading title="Seller channels" description="Amazon and Flipkart seller account API configuration." /><AdminNotice>Amazon requires an authorized SP-API application and LWA refresh token. Flipkart requires an approved seller application. These settings store credentials; catalog and order synchronization must be enabled through an approved connector before use.</AdminNotice><div className="grid gap-6 lg:grid-cols-2">{(["AMAZON", "FLIPKART"] as const).map((provider) => <IntegrationForm key={provider} provider={provider} saved={saved.some((entry) => entry.provider === provider)} canEdit={user.role === "ADMIN"} />)}</div></main>;
}
