import { z } from "zod";
export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  orderNumber: z.string().trim().max(100).default(""),
  subject: z.string().trim().min(3, "Enter a subject of at least 3 characters.").max(150),
  message: z.string().trim().min(10, "Enter a message of at least 10 characters.").max(3000),
  website: z.string().max(200).default(""),
});

type PublicSupportProfile = Partial<{
  companyAddress: string | null;
  companyAddressLine1: string | null;
  companyAddressLine2: string | null;
  companyCity: string | null;
  companyDistrict: string | null;
  companyState: string | null;
  companyCountry: string | null;
  companyLandmark: string | null;
  companyPincode: string | null;
  companyPhone: string | null;
}>;

export function publicSupportDetails(supplier?: PublicSupportProfile) {
  const formattedAddress = [
    supplier?.companyAddressLine1,
    supplier?.companyAddressLine2,
    supplier?.companyCity,
    supplier?.companyDistrict,
    supplier?.companyState,
    supplier?.companyCountry,
    supplier?.companyLandmark,
    supplier?.companyPincode,
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim())).join(", ");
  return {
    email: process.env.SUPPORT_EMAIL || "",
    phone: supplier?.companyPhone?.trim() || process.env.SUPPORT_PHONE || "",
    address: supplier?.companyAddress?.trim() || formattedAddress || process.env.BUSINESS_ADDRESS || "",
    hours: process.env.SUPPORT_HOURS || "",
    responseTime: process.env.SUPPORT_RESPONSE_TIME || "",
  };
}
