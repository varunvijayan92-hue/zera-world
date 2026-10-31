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

export function generateSupplierCredentials(source: Pick<Crypto, "getRandomValues"> = globalThis.crypto) {
  const bytes = source.getRandomValues(new Uint8Array(32));
  const loginId = `sup-${Array.from(bytes.subarray(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const password = `Zw!${Array.from(bytes.subarray(8), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return { loginId, password };
}
