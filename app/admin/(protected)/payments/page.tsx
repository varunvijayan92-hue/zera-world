import { PaymentStatus } from "@prisma/client";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function PaymentsPage({ searchParams }: { searchParams?: Promise<{ status?: string }> }) {
  await requireStoreAdmin();
  const params = searchParams ? await searchParams : {};
  const status = Object.values(PaymentStatus).find((value) => value === params.status);
  const payments = await prisma.paymentTransaction.findMany({ where: status ? { paymentStatus: status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Payments" description="The latest 100 matching payment transactions and their payment status. COD remains pending until receipt is recorded under Orders."><form className="flex gap-2"><select name="status" aria-label="Payment status" defaultValue={status || "ALL"} className="rounded-xl border bg-white px-3 py-2"><option value="ALL">All statuses</option>{Object.values(PaymentStatus).map((entry) => <option key={entry}>{entry}</option>)}</select><button className="rounded-xl bg-[#173B35] px-4 py-2 text-sm text-white">Filter</button></form></AdminHeading><AdminTable columns={["Order", "Provider", "Amount", "Status", "Gateway reference", "Verified / recorded", "Refund"]} empty="Payments will appear after checkout creates an order.">{payments.map((payment) => <tr key={payment.id}><td className="max-w-40 break-words text-xs">{payment.orderId}</td><td>{payment.provider}</td><td>{inr(payment.amount)}</td><td><StateBadge value={payment.paymentStatus} /></td><td className="max-w-48 break-all text-xs">{payment.gatewayPaymentId || payment.gatewayOrderId || (payment.provider === "COD" ? "Awaiting cash receipt" : "Not recorded")}</td><td>{adminDate(payment.verificationTimestamp)}</td><td><StateBadge value={payment.refundStatus} /></td></tr>)}</AdminTable></main>;
}
