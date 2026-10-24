import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  await requireAuth();

  const params = searchParams ? await searchParams : {};
  const statusFilter = params.status ? String(params.status).toUpperCase() : "ALL";

  const payments = await prisma.paymentTransaction.findMany({
    where: statusFilter === "ALL" ? {} : { paymentStatus: statusFilter as any },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const filters = ["ALL", "PENDING", "PAID", "FAILED", "CANCELLED", "REFUNDED"];

  return (
    <section className="rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#173B35]/60">Payments</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#173B35]">Payment operations</h1>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {filters.map((filter) => (
          <a
            key={filter}
            href={`/dashboard/payments${filter === "ALL" ? "" : `?status=${encodeURIComponent(filter)}`}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${statusFilter === filter ? "bg-[#173B35] text-white" : "border border-[#173B35]/10 bg-[#F7F4ED] text-[#173B35]"}`}
          >
            {filter}
          </a>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-[#173B35]/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-[#F7F4ED] text-[#173B35]">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Provider</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Gateway ref</th>
              <th className="px-4 py-3 font-semibold">Refund</th>
            </tr>
          </thead>
          <tbody>
            {payments.length ? payments.map((payment) => (
              <tr key={payment.id} className="border-t border-[#173B35]/10">
                <td className="px-4 py-3 font-semibold text-[#173B35]">{payment.orderId}</td>
                <td className="px-4 py-3 text-[#173B35]/70">{payment.provider}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${payment.paymentStatus === "PAID" ? "bg-[#EAF5EE] text-[#173B35]" : payment.paymentStatus === "FAILED" ? "bg-[#FDE8E8] text-[#7B2D2D]" : "bg-[#F7F4ED] text-[#173B35]"}`}>
                    {payment.paymentStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#173B35]">₹{Number(payment.amount ?? 0).toLocaleString("en-IN")}</td>
                <td className="px-4 py-3 text-[#173B35]/70">{payment.gatewayPaymentId || payment.gatewayOrderId || "—"}</td>
                <td className="px-4 py-3 text-[#173B35]/70">{payment.refundStatus || "NOT_REQUESTED"}</td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#173B35]/60">No payment records found for this filter.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
