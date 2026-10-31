import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeManagement } from "@/lib/api-auth";
import { expenseSchema } from "@/lib/admin-operations";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const denied = await authorizeManagement(); if (denied) return denied;
  const parsed = expenseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter a category, positive amount and valid expense date." }, { status: 400 });
  try {
    const expense = await prisma.expense.create({ data: { ...parsed.data, currency: "INR", expenseDate: new Date(parsed.data.expenseDate) } });
    revalidatePath("/admin/profit-expenses");
    return NextResponse.json({ data: expense }, { status: 201 });
  } catch { return NextResponse.json({ message: "Expense could not be recorded." }, { status: 500 }); }
}
