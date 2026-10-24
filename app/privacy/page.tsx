import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Privacy</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">Privacy policy</h1>
        <div className="mt-5 space-y-4 text-[#173B35]/70">
          <p>ZeraWorld protects personal data used for order processing, delivery, and supplier dispatch coordination.</p>
          <p>We do not store card numbers, CVV values or raw gateway secrets in the application database. Payment verification is handled server-side using approved gateway SDKs and secret validation.</p>
          <p>Customer order details are used only for fulfilment, accounting, and support operations approved by the business.</p>
        </div>
        <Link href="/checkout" className="mt-6 inline-flex rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">Back to checkout</Link>
      </div>
    </main>
  );
}
