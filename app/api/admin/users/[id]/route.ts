import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { getCurrentUser } from "@/lib/auth";
import { userAccessSchema, userAccessError, publicUserSelect, userPasswordSchema, userProfileSchema } from "@/lib/admin-operations";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ message: "Only administrators can manage user access." }, { status: 403 });
  const body = await request.json().catch(() => null);
  const parsed = userAccessSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid role or account status." }, { status: 400 });
  const passwordResult = typeof body?.password === "string" ? userPasswordSchema.safeParse(body.password) : null;
  if (passwordResult && !passwordResult.success) return NextResponse.json({ message: passwordResult.error.issues[0]?.message || "Password must be between 12 and 72 characters." }, { status: 400 });
  const { id } = await params;
  const profile = body?.profile === undefined ? null : userProfileSchema.safeParse(body.profile);
  if (profile && !profile.success) return NextResponse.json({ message: "Enter a valid name, email and login ID." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: publicUserSelect });
      if (!user) return { status: 404, message: "User not found." };
      if (user.role === "ADMIN" && (passwordResult || profile)) return { status: 403, message: "Administrators must edit their own account using email verification." };
      if (profile?.success) {
        const conflict = await tx.user.findFirst({ where: { id: { not: id }, OR: [{ email: { equals: profile.data.email, mode: "insensitive" } }, ...(profile.data.loginId ? [{ loginId: profile.data.loginId }, { email: { equals: profile.data.loginId, mode: "insensitive" as const } }] : [])] }, select: { id: true } });
        if (conflict) return { status: 409, message: "Email or login ID is already in use." };
      }
      const count = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      const message = userAccessError(actor.id, user, parsed.data, count);
      if (message) return { status: 400, message };
      const passwordHash = passwordResult && typeof body?.password === "string" && passwordResult.success ? await bcrypt.hash(body.password, 12) : undefined;
      const data = await tx.user.update({
        where: { id },
        data: {
          ...parsed.data,
          ...(passwordHash ? { passwordHash } : {}),
          ...(profile?.success ? profile.data : {}),
          sessionVersion: { increment: 1 },
        },
        select: publicUserSelect,
      });
      if (profile?.success && user.role === "SUPPLIER") await tx.supplierContact.updateMany({ where: { userId: id }, data: { name: profile.data.fullName, email: profile.data.email } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "USER_ACCOUNT_UPDATED", entityType: "User", entityId: id, details: { profileChanged: !!profile, passwordChanged: !!passwordHash, sessionsRevoked: true } } });
      return { status: 200, data };
    }, { isolationLevel: "Serializable" });
    revalidatePath("/admin/users");
    return NextResponse.json(result, { status: result.status });
  } catch { return NextResponse.json({ message: "Access could not be changed. Refresh and try again." }, { status: 409 }); }
}
