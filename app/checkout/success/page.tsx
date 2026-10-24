import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ order?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const orderId = params.order || "your order";

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 text-center shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Payment</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">Payment review started</h1>
        <p className="mt-4 text-[#173B35]/70">
          Your checkout request for order <span className="font-semibold">{orderId}</span> has been created and is awaiting verified payment confirmation.
        </p>
        <p className="mt-3 text-sm text-[#173B35]/60">
          No supplier fulfilment will be queued until the payment is confirmed by the gateway and the order passes fulfilment checks.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/products" className="rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">Continue shopping</Link>
          <Link href="/dashboard/orders" className="rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-5 py-3 text-sm font-semibold text-[#173B35]">View orders</Link>
        </div>
      </div>
    </main>
  );
}
