import type { Prisma } from "@prisma/client";
import { AccessError } from "./portal-access";

export async function shipmentPickupLocation(tx: Prisma.TransactionClient, supplierId: string | null | undefined, courierName: string) {
  if (courierName !== "Shiprocket") return null;
  if (!supplierId) throw new AccessError("Select the supplier for this Shiprocket AWB.");
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId }, select: { shiprocketPickupLocation: true, status: true } });
  if (!supplier || supplier.status !== "ACTIVE") throw new AccessError("Active supplier not found.");
  if (!supplier.shiprocketPickupLocation) throw new AccessError("Ask an administrator to link this supplier to a Shiprocket pickup location first.");
  return supplier.shiprocketPickupLocation;
}
