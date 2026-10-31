import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { userAccessSchema, userAccessError, publicUserSelect } from "@/lib/admin-operations";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ message: "Only administrators can manage user access." }, { status: 403 });
  const parsed = userAccessSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid role or account status." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, select: publicUserSelect });
      if (!user) return { status: 404, message: "User not found." };
      const count = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
      const message = userAccessError(actor.id, user, parsed.data, count);
      if (message) return { status: 400, message };
      const data = await tx.user.update({ where: { id }, data: parsed.data, select: publicUserSelect });
      return { status: 200, data };
    }, { isolationLevel: "Serializable" });
    revalidatePath("/admin/users");
    return NextResponse.json(result, { status: result.status });
  } catch { return NextResponse.json({ message: "Access could not be changed. Refresh and try again." }, { status: 409 }); }
}
