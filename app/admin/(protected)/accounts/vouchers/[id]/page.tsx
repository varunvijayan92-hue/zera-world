import { notFound } from "next/navigation";
import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { PrintReceipt } from "@/components/print-receipt";
import { expenseVoucherSchema } from "@/lib/expense-vouchers";
import { inr } from "@/lib/admin-format";

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoreAdmin(); const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  const audit = await prisma.auditLog.findFirst({ where: { action: "CREATE_EXPENSE_VOUCHER", entityType: "Expense", entityId: id }, orderBy: { createdAt: "asc" } });
  const parsed = expenseVoucherSchema.safeParse(audit?.details);
  if (!expense || !parsed.success || !audit?.details || typeof audit.details !== "object" || Array.isArray(audit.details)) notFound();
  const voucher = parsed.data;
  return <main className="mx-auto max-w-3xl p-6"><div className="mb-6 flex justify-between print:hidden"><Link href="/admin/accounts" className="underline">Accounts</Link><PrintReceipt label="Print expense voucher" /></div><article className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold">Zera&apos;s World — Expense voucher</h1><p className="my-4 break-all">{String(audit.details.number)}</p><dl className="grid gap-4 sm:grid-cols-2">{[["Date", voucher.date], ["Category", voucher.category], ["Paid to", voucher.payee], ["Total paid (INR)", inr(expense.amount)], ["Payment method", voucher.paymentMethod], ["Bill reference", voucher.reference || "Not recorded"], ["Payment reference", voucher.paymentReference || "Not recorded"], ["Description", voucher.description]].map(([label, value]) => <div key={label}><dt className="text-sm opacity-60">{label}</dt><dd className="break-words font-semibold">{value}</dd></div>)}</dl><p className="mt-6 text-sm">Internal payment record. Retain the supplier&apos;s original invoice. This voucher does not establish input tax credit eligibility.</p></article></main>;
}
