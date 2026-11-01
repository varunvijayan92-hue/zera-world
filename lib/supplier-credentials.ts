import { z } from "zod";

export const supplierLoginIdSchema = z.string().trim().toLowerCase().min(3).max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use letters, numbers, dots, underscores or hyphens for the login ID.");
export const supplierPasswordSchema = z.string().min(12, "Use a password of at least 12 characters.")
  .refine((value) => new TextEncoder().encode(value).length <= 72, "Use at most 72 UTF-8 bytes for the password.");
export const supplierLoginCreateSchema = z.object({ loginId: supplierLoginIdSchema, password: supplierPasswordSchema });
const optionalBlank = (value: unknown) => value === "" ? undefined : value;
export const supplierCredentialUpdateSchema = z.object({
  userId: z.string().min(1),
  loginId: z.preprocess(optionalBlank, supplierLoginIdSchema.optional()),
  password: z.preprocess(optionalBlank, supplierPasswordSchema.optional()),
  isActive: z.boolean().optional(),
}).refine((value) => value.loginId !== undefined || value.password !== undefined || value.isActive !== undefined, "Enter a login ID, new password or access change.");

function normalizeSupplierCredentialPart(value: string, fallback = "supplier") {
  const cleaned = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

export function generateSupplierCredentials(companyName?: string, joinedAt?: Date | string | number) {
  const name = normalizeSupplierCredentialPart(companyName || "supplier", "supplier");
  const year = joinedAt ? new Date(joinedAt).getFullYear() : new Date().getFullYear();
  const safeName = name.slice(0, 28);
  const loginId = safeName || "supplier";
  const password = `${safeName}${year}`;
  return { loginId, password };
}
