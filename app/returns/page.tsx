import Link from "next/link";

export default function ReturnsPage() {
  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Returns</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">Return and refund policy</h1>
        <div className="mt-5 space-y-4 text-[#173B35]/70">
          <p>Returns are evaluated on a case-by-case basis based on supplier policy, delivery condition, and marketplace eligibility.</p>
          <p>Refunds are only processed after successful gateway confirmation and a verified fulfilment review. Duplicate refunds are blocked.</p>
          <p>Customers should contact support with their order reference and product condition for assessment.</p>
        </div>
        <Link href="/checkout" className="mt-6 inline-flex rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">Back to checkout</Link>
      </div>
    </main>
  );
}
