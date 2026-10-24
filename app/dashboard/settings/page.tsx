import { requireAuth } from "@/lib/auth";

export default async function SettingsPage() {
  await requireAuth();

  return (
    <section className="rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#173B35]/60">Settings</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#173B35]">ZeraWorld Connect configuration</h1>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-5">
          <h2 className="text-lg font-bold text-[#173B35]">Platform profile</h2>
          <div className="mt-4 space-y-3 text-sm text-[#173B35]/70">
            <p>Business name: ZeraWorld</p>
            <p>Platform: ZeraWorld Connect</p>
            <p>Currency: INR</p>
          </div>
        </div>

        <div className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-5">
          <h2 className="text-lg font-bold text-[#173B35]">External integrations</h2>
          <div className="mt-4 space-y-3 text-sm text-[#173B35]/70">
            <p>Marketplace partners: not connected by default</p>
            <p>Supplier sync: ready for configuration</p>
            <p>Webhook verification: available</p>
          </div>
        </div>
      </div>
    </section>
  );
}
