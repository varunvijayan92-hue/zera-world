import { authorizeManagement } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validators";
import bcrypt from "bcryptjs";
import { supplierLoginCreateSchema } from "@/lib/supplier-credentials";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

export async function GET() {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: suppliers });
}

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const body = await request.json();
    const parsed = supplierSchema.extend({ portalLogin: supplierLoginCreateSchema.optional() }).safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid supplier payload." },
        { status: 400 }
      );
    }

    const { portalLogin, ...data } = parsed.data;
    if (portalLogin && actor?.role !== "ADMIN") throw new AccessError("Only administrators can create supplier logins.", 403);
    if (portalLogin && data.sourceType !== "DIRECT") throw new AccessError("External-site sources do not receive supplier portal accounts.");
    if (portalLogin && !data.email) throw new AccessError("Enter the supplier's contact email to create a login.");
    const passwordHash = portalLogin ? await bcrypt.hash(portalLogin.password, 12) : undefined;
    const result = await prisma.$transaction(async (tx) => {
      if (portalLogin && await tx.user.findFirst({ where: { OR: [{ loginId: portalLogin.loginId }, { email: { equals: data.email!, mode: "insensitive" } }] }, select: { id: true } })) throw new AccessError("The login ID or contact email already has an account. Choose another.", 409);
      const supplier = await tx.supplier.create({ data: { ...data, status: data.status || "ACTIVE", minOrderQty: data.minOrderQty ?? null, leadTimeDays: data.leadTimeDays ?? null, shippingCharges: data.shippingCharges ?? null } });
      let login: { id: string; loginId: string | null; email: string } | null = null;
      if (portalLogin && passwordHash) {
        login = await tx.user.create({ data: { loginId: portalLogin.loginId, email: data.email!.trim().toLowerCase(), fullName: data.contactName || data.companyName, passwordHash, role: "SUPPLIER" }, select: { id: true, loginId: true, email: true } });
        await tx.supplierContact.create({ data: { supplierId: supplier.id, userId: login.id, name: data.contactName || data.companyName, email: login.email, isPrimary: true } });
      }
      await tx.auditLog.create({ data: { userId: actor!.id, action: "SUPPLIER_CREATED", entityType: "Supplier", entityId: supplier.id, details: { portalLoginCreated: !!login } } });
      return { supplier, login };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: result.supplier, login: result.login }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
