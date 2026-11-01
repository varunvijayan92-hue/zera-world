import { z } from "zod";

export const stockUpdateSchema = z.object({
  availableQty: z.number().int().min(0).max(10000000), reservedQty: z.number().int().min(0).max(10000000),
  damagedQty: z.number().int().min(0).max(10000000), safetyStock: z.number().int().min(0).max(10000000),
  updatedAt: z.string().datetime(),
}).refine((value) => value.reservedQty <= value.availableQty, "Reserved quantity cannot exceed available stock.");

export const expenseSchema = z.object({
  category: z.string().trim().min(1).max(80), description: z.string().trim().max(500).default(""),
  amount: z.number().finite().positive().max(100000000), expenseDate: z.string().datetime(),
});
export const userCreateSchema = z.object({
  fullName: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(12).max(72).refine((password) => new TextEncoder().encode(password).length <= 72, "Use a password no longer than 72 UTF-8 bytes."),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "SUPPLIER", "CUSTOMER"]).default("STAFF"),
});
export const userPasswordSchema = z.string().min(12).max(72).refine((password) => new TextEncoder().encode(password).length <= 72, "Use a password no longer than 72 UTF-8 bytes.");
export const userAccessSchema = z.object({ role: z.enum(["ADMIN", "MANAGER", "STAFF", "SUPPLIER", "CUSTOMER"]), isActive: z.boolean() });

export function userAccessError(actorId: string, target: { id: string; role: string; isActive: boolean }, next: { role: string; isActive: boolean }, activeAdminCount: number) {
  if (actorId === target.id && (next.role !== "ADMIN" || !next.isActive)) return "You cannot remove your own administrator access.";
  if (target.role === "ADMIN" && target.isActive && (next.role !== "ADMIN" || !next.isActive) && activeAdminCount <= 1) return "Keep at least one active administrator.";
  return null;
}

export const publicUserSelect = { id: true, email: true, fullName: true, role: true, isActive: true, createdAt: true } as const;
