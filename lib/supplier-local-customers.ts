import { z } from "zod";

export const supplierLocalCustomerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().max(30).default(""),
  email: z.string().trim().max(254).email().or(z.literal("")).default(""),
  address: z.string().trim().max(1000).default(""),
  notes: z.string().trim().max(1000).default(""),
}).refine(value => !!value.phone || !!value.email, { message: "Enter a phone number or email address." });
