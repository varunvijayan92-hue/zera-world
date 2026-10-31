import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { apiError, AccessError } from "@/lib/portal-access";
import { isSameOriginRequest } from "@/lib/request-origin";
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || !["CUSTOMER", "SUPPLIER"].includes(user.role) || !isSameOriginRequest(request)) throw new AccessError("Sign in required.", 401);
    const parsed = z.object({ subject: z.string().trim().min(3).max(100), message: z.string().trim().min(10).max(3000) }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Enter a subject and a question of at least 10 characters.");
    await prisma.supportTicket.create({ data: { ...parsed.data, userId: user.id } });
    return NextResponse.json({ message: "Your question has been sent to store support." }, { status: 201 });
  } catch (error) { return apiError(error); }
}
