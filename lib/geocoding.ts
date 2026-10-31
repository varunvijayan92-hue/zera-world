import { z } from "zod";

export const coordinatesSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const propertiesSchema = z.object({
  housenumber: z.string().optional(), street: z.string().optional(), name: z.string().optional(),
  district: z.string().optional(), locality: z.string().optional(), city: z.string().optional(),
  county: z.string().optional(), state: z.string().optional(), postcode: z.string().optional(), country: z.string().optional(),
});
const responseSchema = z.object({ features: z.array(z.object({ properties: propertiesSchema })) });

export function addressFromPhoton(value: unknown) {
  const parsed = responseSchema.safeParse(value);
  const address = parsed.success ? parsed.data.features[0]?.properties : undefined;
  if (!address) return null;
  return {
    addressLine1: [address.housenumber, address.street || address.name].filter(Boolean).join(" "),
    addressLine2: address.district || address.locality || "",
    city: address.city || address.county || "", state: address.state || "",
    pincode: address.postcode || "", country: address.country || "",
  };
}
