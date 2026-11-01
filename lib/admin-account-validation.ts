import { z } from "zod";
export const adminProfileSchema = z.object({ fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform(v => v.toLowerCase()), loginId: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/, "Use letters, numbers, dots, underscores or hyphens for the login ID.").transform(v => v.toLowerCase()) });
export const adminPasswordSchema = z.string().min(12, "Use at least 12 characters.").refine(v => Buffer.byteLength(v, "utf8") <= 72, "Password must be at most 72 bytes.");
export const accountChangeSchema = z.discriminatedUnion("purpose", [z.object({ purpose: z.literal("PROFILE"), currentPassword: z.string().min(1).max(200), profile: adminProfileSchema }), z.object({ purpose: z.literal("PASSWORD"), currentPassword: z.string().min(1).max(200), newPassword: adminPasswordSchema })]);
export const accountVerifySchema = z.object({ challengeId: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().regex(/^\d{6}$/) });
