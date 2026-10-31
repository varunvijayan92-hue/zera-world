import { z } from "zod";
export const contactSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").max(254),
  orderNumber: z.string().trim().max(100).default(""),
  subject: z.string().trim().min(3, "Enter a subject of at least 3 characters.").max(150),
  message: z.string().trim().min(10, "Enter a message of at least 10 characters.").max(3000),
  website: z.string().max(200).default(""),
});
export function publicSupportDetails() {
  return { email: process.env.SUPPORT_EMAIL || "", phone: process.env.SUPPORT_PHONE || "", address: process.env.BUSINESS_ADDRESS || "", hours: process.env.SUPPORT_HOURS || "", responseTime: process.env.SUPPORT_RESPONSE_TIME || "" };
}
