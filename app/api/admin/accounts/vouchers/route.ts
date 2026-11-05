import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { expenseVoucherSchema, voucherDescription } from "@/lib/expense-vouchers";

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = expenseVoucherSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check voucher details.");
    const input = parsed.data;
    const number = `EV-${input.date.replaceAll("-", "")}-${input.submissionId}`;
    const expense = await prisma.$transaction(async tx => {
      const saved = await tx.expense.create({ data: { id: `ev-${input.submissionId}`, category: input.category, description: voucherDescription(input), amount: input.amount.toFixed(2), currency: "INR", expenseDate: new Date(`${input.date}T12:00:00+05:30`) } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "CREATE_EXPENSE_VOUCHER", entityType: "Expense", entityId: saved.id, details: { ...input, number } } });
      return saved;
    });
    revalidatePath("/admin/accounts"); revalidatePath("/admin/profit-expenses");
    return NextResponse.json({ id: expense.id, number, message: "Expense voucher recorded." }, { status: 201 });
  } catch (error) { return apiError(error); }
}
