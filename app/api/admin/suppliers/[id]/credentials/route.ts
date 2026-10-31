import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { supplierCredentialUpdateSchema } from "@/lib/supplier-credentials";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request);
    if (actor.role !== "ADMIN") throw new AccessError("Only administrators can change supplier credentials.", 403);
    const { id } = await params;
    const parsed = supplierCredentialUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check the login details.");
    const data = parsed.data;
    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : undefined;
    const user = await prisma.$transaction(async (tx) => {
      const contact = await tx.supplierContact.findFirst({ where: { supplierId: id, userId: data.userId, user: { role: "SUPPLIER" } }, select: { userId: true } });
      if (!contact?.userId) throw new AccessError("This login does not belong to this supplier.", 404);
      const updated = await tx.user.update({ where: { id: contact.userId }, data: { ...(data.loginId ? { loginId: data.loginId } : {}), ...(passwordHash ? { passwordHash } : {}), ...(data.isActive !== undefined ? { isActive: data.isActive } : {}), sessionVersion: { increment: 1 } }, select: { id: true, loginId: true, email: true, isActive: true } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "SUPPLIER_CREDENTIALS_UPDATED", entityType: "Supplier", entityId: id, details: { userId: updated.id, loginIdChanged: data.loginId !== undefined, passwordReset: !!passwordHash, accessChanged: data.isActive !== undefined } } });
      return updated;
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: user, message: "Supplier login updated. Existing sessions have been signed out." });
  } catch (error) { return apiError(error); }
}
