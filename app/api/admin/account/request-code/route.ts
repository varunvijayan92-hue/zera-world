import bcrypt from "bcryptjs";
import { z } from "zod";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { isProductionSecureContext } from "@/lib/site";
import { rateLimited } from "@/lib/rate-limit";
import { accountChangeSchema } from "@/lib/admin-account-validation";
import { ADMIN_CHANGE_COOKIE, issueAdminAccountChange } from "@/lib/admin-account";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ message: "Administrator access required." }, { status: actor ? 403 : 401 });
  if (rateLimited(request, "admin-account-code", 10)) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = accountChangeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Check your account details." }, { status: 400 });
  try {
    const user = await prisma.user.findUnique({ where: { id: actor.id } });
    if (!user || !user.isActive || user.role !== "ADMIN" || !await bcrypt.compare(parsed.data.currentPassword, user.passwordHash)) return NextResponse.json({ message: "Your current password is incorrect." }, { status: 400 });
    const change = parsed.data;
    if (change.purpose === "PASSWORD" && !z.string().email().safeParse(user.email).success) return NextResponse.json({ message: "First use Edit account to add and verify a valid email address." }, { status: 400 });
    if (change.purpose === "PROFILE") {
      const conflict = await prisma.user.findFirst({ where: { id: { not: user.id }, OR: [{ email: { equals: change.profile.email, mode: "insensitive" } }, { loginId: change.profile.loginId }, { email: { equals: change.profile.loginId, mode: "insensitive" } }, { loginId: change.profile.email }] }, select: { id: true } });
      if (conflict) return NextResponse.json({ message: "Email or login ID is already in use." }, { status: 409 });
    }
    const challengeId = await issueAdminAccountChange(user, change.purpose === "PROFILE" ? change : { purpose: "PASSWORD", passwordHash: await bcrypt.hash(change.newPassword, 12) });
    if (!challengeId) return NextResponse.json({ message: "Wait one minute before requesting a new code. Maximum five emails per hour." }, { status: 429 });
    const response = NextResponse.json({ challengeId, message: change.purpose === "PROFILE" ? "Code sent to the email you entered. Enter it to save your profile." : "Code sent to your saved admin email. Enter it to change your password." });
    response.cookies.set(ADMIN_CHANGE_COOKIE, challengeId, { httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", path: "/api/admin/account", maxAge: 600 });
    return response;
  } catch { return NextResponse.json({ message: "The verification email could not be sent. Please try again later." }, { status: 503 }); }
}
