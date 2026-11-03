import { z } from "zod";

export const supplierPickupAddressSchema = z.object({
  pickupAddressLine1: z.string().trim().max(200).optional(),
  pickupAddressLine2: z.string().trim().max(200).optional(),
  pickupCity: z.string().trim().max(120).optional(),
  pickupDistrict: z.string().trim().max(120).optional(),
  pickupState: z.string().trim().max(120).optional(),
  pickupCountry: z.string().trim().max(120).optional(),
  pickupLandmark: z.string().trim().max(200).optional(),
  pickupPincode: z.string().trim().max(20).optional(),
});
export const supplierPickupFields: [string, string, string][] = [
  ["pickupAddressLine1", "Pickup address line 1", "text"],
  ["pickupAddressLine2", "Pickup address line 2", "text"],
  ["pickupCity", "Pickup city", "text"], ["pickupDistrict", "Pickup district", "text"],
  ["pickupState", "Pickup state", "text"], ["pickupCountry", "Pickup country", "text"],
  ["pickupLandmark", "Pickup landmark", "text"], ["pickupPincode", "Pickup pincode", "text"],
];
export const emptySupplierPickupAddress = { pickupAddressLine1: "", pickupAddressLine2: "", pickupCity: "", pickupDistrict: "", pickupState: "", pickupCountry: "India", pickupLandmark: "", pickupPincode: "" };

export function formatSupplierPickupAddress(values: Record<string, unknown>) {
  const keys = supplierPickupFields.map(([key]) => key);
  if (!keys.some(key => key !== "pickupCountry" && typeof values[key] === "string" && String(values[key]).trim())) return null;
  return keys.map(key => values[key]).filter((value): value is string => typeof value === "string" && !!value.trim()).map(value => value.trim()).join(", ");
}
