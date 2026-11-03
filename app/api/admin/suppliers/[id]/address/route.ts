import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supplierPickupAddressSchema } from "@/lib/supplier-address";
import { updateSupplierProfile } from "@/lib/supplier-profile";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await portalUser("ADMIN", request); const { id } = await params;
    const parsed = supplierPickupAddressSchema.extend({ contactName: z.string().trim().max(100).optional(), phone: z.string().trim().max(30).optional() }).safeParse(await request.json());
    if (!parsed.success || !Object.keys(parsed.data).length) throw new AccessError("Check the supplier pickup address.");
    await prisma.$transaction(async tx => {
      await updateSupplierProfile(tx, id, parsed.data);
      await tx.auditLog.create({ data: { userId: actor.id, action: "UPDATE_SUPPLIER_ADDRESS", entityType: "Supplier", entityId: id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Supplier pickup/local address saved. Recheck its Shiprocket pickup mapping if the address changed." });
  } catch (error) { return apiError(error); }
}
