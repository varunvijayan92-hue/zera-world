import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { shiprocketPickupLocations } from "@/lib/shiprocket";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await portalUser("ADMIN", request);
    const { id } = await params;
    const parsed = z.object({ pickupLocation: z.string().trim().min(1).max(200).nullable() }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Select a registered pickup location or clear the mapping.");
    const location = parsed.data.pickupLocation;
    if (location && !(await shiprocketPickupLocations()).some(entry => entry.name === location)) throw new AccessError("This pickup location is no longer available in Shiprocket. Reload the locations and choose again.");
    await prisma.$transaction(async tx => {
      const supplier = await tx.supplier.findUnique({ where: { id }, select: { id: true } });
      if (!supplier) throw new AccessError("Supplier not found.", 404);
      await tx.supplier.update({ where: { id }, data: { shiprocketPickupLocation: location } });
      await tx.auditLog.create({ data: { userId: user.id, action: "UPDATE_SUPPLIER_PICKUP", entityType: "Supplier", entityId: id, details: { pickupLocation: location } } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: location ? "Supplier pickup location linked." : "Pickup mapping cleared. Existing shipments retain their recorded pickup locations." });
  } catch (error) { return apiError(error); }
}
