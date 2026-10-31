import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminStat, AdminTable } from "@/components/admin-ui";
import { ExpenseForm } from "@/components/admin-record-forms";

export default async function ProfitExpensesPage() {
  await requireStoreAdmin();
  const [expenses, totalExpenses, catalog, captured] = await Promise.all([
    prisma.expense.findMany({ orderBy: { expenseDate: "desc" }, take: 100 }),
    prisma.expense.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.product.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, sku: true, costPrice: true, sellingPrice: true }, orderBy: { name: "asc" }, take: 100 }),
    prisma.paymentTransaction.aggregate({ where: { paymentStatus: "PAID" }, _sum: { amount: true } }),
  ]);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Profit & Expenses" description="Recorded business expenses and current catalog margin estimates." /><div className="mb-7 grid gap-4 sm:grid-cols-3"><AdminStat label="Recorded expenses" value={inr(totalExpenses._sum.amount)} /><AdminStat label="Expense entries" value={totalExpenses._count} /><AdminStat label="Captured payments" value={inr(captured._sum.amount)} detail="Recorded PAID amounts, not net profit." /></div><AdminNotice>Catalog margins below use current selling and cost prices only. Shipping, tax, gateway fees, refunds and other expenses are not included, so they are not settled profit figures.</AdminNotice><ExpenseForm /><h2 className="mb-4 text-xl font-bold">Recent expenses</h2><AdminTable columns={["Category", "Description", "Amount", "Date"]} empty="No expenses recorded. Add an expense above.">{expenses.map((expense) => <tr key={expense.id}><td className="font-semibold">{expense.category}</td><td>{expense.description || "Not recorded"}</td><td>{inr(expense.amount)}</td><td>{adminDate(expense.expenseDate)}</td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Current catalog margins</h2><AdminTable columns={["Product", "Selling price", "Catalog cost", "Gross difference", "Gross margin"]} empty="No active products.">{catalog.map((product) => { const price = Number(product.sellingPrice || 0); const cost = Number(product.costPrice || 0); return <tr key={product.id}><td><p className="font-semibold">{product.name}</p><p className="text-xs">{product.sku}</p></td><td>{inr(price)}</td><td>{product.costPrice === null ? "Not recorded" : inr(cost)}</td><td>{product.costPrice === null ? "Not available" : inr(price - cost)}</td><td>{product.costPrice === null || !price ? "Not available" : `${((price - cost) / price * 100).toFixed(1)}%`}</td></tr>; })}</AdminTable></main>;
}
