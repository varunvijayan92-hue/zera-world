import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeManagement } from "@/lib/api-auth";
import { stockUpdateSchema } from "@/lib/admin-operations";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const denied = await authorizeManagement(); if (denied) return denied;
  const parsed = stockUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid stock values." }, { status: 400 });
  const { id } = await params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.inventory.findUnique({ where: { id } });
      if (!current) return { status: 404, message: "Stock record not found." };
      if (current.status !== "AVAILABLE") return { status: 400, message: "Only available stock records can be adjusted here." };
      if (current.updatedAt.toISOString() !== parsed.data.updatedAt) return { status: 409, message: "Stock changed since this page loaded. Refresh before editing it." };
      const { updatedAt: _version, ...stock } = parsed.data;
      const data = await tx.inventory.update({ where: { id }, data: { ...stock, lastUpdatedAt: new Date() }, select: { id: true, availableQty: true, reservedQty: true, damagedQty: true, safetyStock: true, updatedAt: true } });
      return { status: 200, data };
    }, { isolationLevel: "Serializable" });
    if (result.status === 200) for (const path of ["/admin/inventory", "/admin/products", "/products", "/checkout"]) revalidatePath(path);
    return NextResponse.json(result, { status: result.status });
  } catch { return NextResponse.json({ message: "Stock could not be saved. Refresh and try again." }, { status: 409 }); }
}
