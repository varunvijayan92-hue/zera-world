import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ order?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const orderId = params.order || "your order";
  const payment = params.order ? await prisma.paymentTransaction.findFirst({
    where: { orderId: params.order }, select: { paymentStatus: true },
  }).catch(() => null) : null;
  const isPaid = payment?.paymentStatus === "PAID";

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
      <div className="mx-auto max-w-2xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 text-center shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Payment</p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">{isPaid ? "Payment verified" : "Payment confirmation pending"}</h1>
        <p className="mt-4 text-[#173B35]/70">
          Your checkout request for order <span className="font-semibold">{orderId}</span> {isPaid ? "has been paid. Your payment was verified by the server." : "is awaiting captured payment confirmation. Keep your order reference and avoid making a second payment."}
        </p>
        <p className="mt-3 text-sm text-[#173B35]/60">
          Keep this order reference for any payment or delivery enquiries.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/products" className="rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">Continue shopping</Link>
          <Link href="/" className="rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-5 py-3 text-sm font-semibold text-[#173B35]">Back to home</Link>
        </div>
      </div>
    </main>
  );
}
