import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { userCreateSchema, publicUserSelect } from "@/lib/admin-operations";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ message: "Only administrators can manage user access." }, { status: 403 });
  const parsed = userCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid account details." }, { status: 400 });
  try {
    const { password, ...data } = parsed.data;
    if (await prisma.user.findFirst({ where: { email: { equals: data.email, mode: "insensitive" } }, select: { id: true } })) return NextResponse.json({ message: "That email is already used." }, { status: 409 });
    const user = await prisma.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) }, select: publicUserSelect });
    revalidatePath("/admin/users");
    return NextResponse.json({ data: user }, { status: 201 });
  } catch { return NextResponse.json({ message: "User could not be created. Check that the email is not already used." }, { status: 409 }); }
}
