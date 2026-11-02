import type { Prisma } from "@prisma/client";
import { AccessError } from "./portal-access";

export async function updateSupplierProfile(tx: Prisma.TransactionClient, supplierId: string, changes: Record<string, unknown>) {
  const current = await tx.supplier.findUnique({ where: { id: supplierId } });
  if (!current) throw new AccessError("Supplier not found.", 404);
  // The pickup and company forms submit different subsets. Omitted fields stay intact.
  const data = Object.fromEntries(Object.entries(changes).filter(([key, value]) => key !== "action" && value !== undefined).map(([key, value]) => [key, typeof value === "string" ? value.trim() || null : value]));
  const merged = { ...current, ...data } as Record<string, unknown>;
  for (const prefix of ["pickup", "company"]) {
    const fields = ["AddressLine1", "AddressLine2", "City", "District", "State", "Country", "Landmark", "Pincode"].map(suffix => prefix + suffix);
    if (fields.some(key => Object.hasOwn(data, key))) data[prefix + "Address"] = fields.map(key => merged[key]).filter(value => typeof value === "string" && value.trim()).join(", ") || null;
  }
  if (Object.hasOwn(data, "pickupAddress") && data.pickupAddress !== current.pickupAddress) data.shiprocketPickupLocation = null;
  await tx.supplier.update({ where: { id: supplierId }, data });
}
