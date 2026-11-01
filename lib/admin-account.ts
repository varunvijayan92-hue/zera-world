import { randomBytes, randomInt } from "node:crypto";
import { prisma } from "./prisma";
import { emailDelivery } from "./email";
import { otpDigest, otpMatches } from "./customer-otp";
import { adminProfileSchema } from "./admin-account-validation";
export const ADMIN_CHANGE_COOKIE = "zera_admin_account_change";
type ChangeUser = { id: string; email: string; sessionVersion: number };
type Change = { purpose: "PROFILE"; profile: { fullName: string; email: string; loginId: string } } | { purpose: "PASSWORD"; passwordHash: string };
type StoredChange = { userId: string; challengeId: string; digest: string; sessionVersion: number; purpose: string; email: string; payload: Record<string, unknown>; attempts: number; expiresAt: Date; consumedAt: Date | null };
export async function issueAdminAccountChange(user: ChangeUser, change: Change) {
  const challengeId = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const digest = otpDigest(`admin-account:${challengeId}`, code);
  const email = change.purpose === "PROFILE" ? change.profile.email : user.email;
  const payload = JSON.stringify(change.purpose === "PROFILE" ? change.profile : { passwordHash: change.passwordHash });
  const issued = await prisma.$queryRaw<{ userId: string }[]>`
    INSERT INTO "AdminAccountChallenge" ("userId", "challengeId", "digest", "sessionVersion", "purpose", "email", "payload", "expiresAt", "sentAt", "windowStart")
    VALUES (${user.id}, ${challengeId}, ${digest}, ${user.sessionVersion}, ${change.purpose}, ${email}, ${payload}::jsonb, CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "challengeId" = EXCLUDED."challengeId", "digest" = EXCLUDED."digest", "sessionVersion" = EXCLUDED."sessionVersion", "purpose" = EXCLUDED."purpose", "email" = EXCLUDED."email", "payload" = EXCLUDED."payload",
      "attempts" = 0, "expiresAt" = EXCLUDED."expiresAt", "sentAt" = CURRENT_TIMESTAMP, "consumedAt" = NULL,
      "sendCount" = CASE WHEN "AdminAccountChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE "AdminAccountChallenge"."sendCount" + 1 END,
      "windowStart" = CASE WHEN "AdminAccountChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE "AdminAccountChallenge"."windowStart" END
    WHERE "AdminAccountChallenge"."sentAt" < CURRENT_TIMESTAMP - INTERVAL '1 minute'
      AND ("AdminAccountChallenge"."sendCount" < 5 OR "AdminAccountChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour') RETURNING "userId"`;
  if (!issued.length) return null;
  try {
    await emailDelivery.send({ to: email, subject: "Confirm your Zera's World admin account change", text: `Your admin ${change.purpose === "PASSWORD" ? "password change" : "profile update"} code is ${code}.\n\nIt expires in 10 minutes and works once. Do not share this code. If you did not request this, do not approve the change.` }, `admin-account/${challengeId}`);
  } catch {
    await prisma.$executeRaw`UPDATE "AdminAccountChallenge" SET "consumedAt" = CURRENT_TIMESTAMP, "payload" = '{}'::jsonb WHERE "challengeId" = ${challengeId}`;
    throw Error("Email could not be sent.");
  }
  return challengeId;
}
export async function applyAdminAccountChange(userId: string, challengeId: string, code: string) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<StoredChange[]>`SELECT * FROM "AdminAccountChallenge" WHERE "userId" = ${userId} AND "challengeId" = ${challengeId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.consumedAt || row.attempts >= 5 || row.expiresAt.getTime() <= Date.now()) return false;
    await tx.$executeRaw`UPDATE "AdminAccountChallenge" SET "attempts" = "attempts" + 1 WHERE "challengeId" = ${challengeId}`;
    if (!otpMatches(`admin-account:${challengeId}`, code, row.digest)) return false;
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive || user.role !== "ADMIN" || user.sessionVersion !== row.sessionVersion) return false;
    const data = row.purpose === "PROFILE" ? adminProfileSchema.parse(row.payload) : row.purpose === "PASSWORD" && typeof row.payload.passwordHash === "string" && row.email === user.email ? { passwordHash: row.payload.passwordHash } : null;
    if (!data) return false;
    const updated = await tx.user.updateMany({ where: { id: userId, sessionVersion: row.sessionVersion, role: "ADMIN", isActive: true }, data: { ...data, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) return false;
    await tx.$executeRaw`UPDATE "AdminAccountChallenge" SET "consumedAt" = CURRENT_TIMESTAMP, "payload" = '{}'::jsonb WHERE "challengeId" = ${challengeId}`;
    await tx.auditLog.create({ data: { userId, action: "ADMIN_ACCOUNT_UPDATED", entityType: "User", entityId: userId, details: { purpose: row.purpose, emailVerified: true, sessionsRevoked: true } } });
    return true;
  });
}
