import { z } from "zod";

export const customerWhatsAppPhone = z.string().trim().transform(value => value.replace(/[\s()-]/g, "").replace(/^\+/, "").replace(/^91(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian WhatsApp number."));

export const customerRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  password: z.string().min(12).refine(value => Buffer.byteLength(value, "utf8") <= 72),
  phone: customerWhatsAppPhone,
  whatsappEnabled: z.boolean().default(false),
});
