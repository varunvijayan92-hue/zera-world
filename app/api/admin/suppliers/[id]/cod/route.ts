import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request);
    const { id } = await params;
    const input = z.object({ codHandling: z.enum(["NONE", "OWN_COURIER", "SUPPLIER_COURIER", "EITHER"]) }).safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Choose a COD collection arrangement.");
    await prisma.$transaction(async tx => {
      const updated = await tx.supplier.updateMany({ where: { id }, data: { codHandling: input.data.codHandling } });
      if (!updated.count) throw new AccessError("Supplier not found.", 404);
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE_SUPPLIER_COD_HANDLING", entityType: "Supplier", entityId: id, details: { codHandling: input.data.codHandling } } });
    });
    return NextResponse.json({ message: "COD arrangement saved. Couriers and supplier orders must still be arranged through their supported workflow." });
  } catch (error) { return apiError(error); }
}
