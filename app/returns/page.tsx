import Link from "next/link";

export default function ReturnsPage() {
  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Returns</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">Return &amp; Refund Policy</h1>
        <div className="mt-5 space-y-4 text-[#173B35]/70">
          <p>For damaged, defective, incorrect or undelivered items, <Link href="/contact" className="font-semibold underline">contact support</Link> with your order reference and details, including when the standard online return option is unavailable. Product return restrictions do not exclude applicable consumer rights.</p>
          <p>Each product shows its return window or non-returnable status. For eligible purchases placed while signed in, open My account, select Orders, and submit a return reason after delivery is confirmed.</p>
          <p>Refunds are only processed after successful gateway confirmation and a verified fulfilment review. Duplicate refunds are blocked.</p>
          <p>The return window begins when delivery is confirmed. Shipping and handling are excluded from the item-price-plus-GST return refund. Guest customers can contact support with the order reference and product condition.</p>
        </div>
        <Link href="/account" className="mt-6 inline-flex rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">View my orders</Link>
      </div>
    </main>
  );
}
