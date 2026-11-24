import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { IntegrationForm } from "@/components/integration-form";
import { CjIntegrationForm } from "@/components/cj-integration-form";
import { AdminHeading, AdminNotice } from "@/components/admin-ui";
import Link from "next/link";
import { WhatsAppStatus } from "@/components/whatsapp-status";

export default async function SettingsPage() {
  const user = await requireStoreAdmin();
  const saved = await prisma.integrationSetting.findMany({ select: { provider: true } });
  const canEdit = user.role === "ADMIN";
  const isSaved = (provider: string) => saved.some(entry => entry.provider === provider);

  return (
    <main className="mx-auto max-w-6xl p-5 md:p-8">
      <AdminHeading title="Settings" description="Payments, courier APIs and store connections." />
      <IntegrationForm provider="META_WHATSAPP" saved={isSaved("META_WHATSAPP")} canEdit={canEdit} />
      <WhatsAppStatus canEdit={canEdit} />
      <div className="mt-8">
        <AdminNotice>Razorpay server environment credentials are used when no admin credential override has been saved. Shiprocket uses a dedicated API user email and password. Delhivery uses your business API token.</AdminNotice>
        <Link className="mb-5 inline-block font-semibold underline" href="/admin/sellers">Amazon &amp; Flipkart seller settings</Link>
        <div className="grid gap-6 lg:grid-cols-2">
          {(["RAZORPAY", "SHIPROCKET", "DELHIVERY"] as const).map(provider => (
            <IntegrationForm key={provider} provider={provider} saved={isSaved(provider)} canEdit={canEdit} />
          ))}
          <CjIntegrationForm saved={isSaved("CJ_DROPSHIPPING")} canEdit={canEdit} />
        </div>
      </div>
    </main>
  );
}
