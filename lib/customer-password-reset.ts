import { randomBytes, randomInt, createHash } from "node:crypto";
import { prisma } from "./prisma";
import { emailDelivery } from "./email";
import { otpDigest, otpMatches } from "./customer-otp";
export const RESET_COOKIE = "zera_customer_reset";
export const RESET_PROOF_COOKIE = "zera_customer_reset_proof";
export const resetProofDigest = (proof: string) => createHash("sha256").update(proof).digest("hex");
type Reset = { userId: string; challengeId: string; digest: string; sessionVersion: number; attempts: number; expiresAt: Date; verifiedAt: Date | null; proofDigest: string | null; resetAt: Date | null };
export async function requestCustomerReset(email: string) {
  const challengeId = randomBytes(32).toString("hex");
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, role: "CUSTOMER", isActive: true } });
  if (!user) return challengeId;
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const digest = otpDigest(`password-reset:${challengeId}`, code);
  const rows = await prisma.$queryRaw<{ userId: string }[]>`
    INSERT INTO "CustomerPasswordReset" ("userId", "challengeId", "digest", "sessionVersion", "expiresAt", "sentAt", "windowStart")
    VALUES (${user.id}, ${challengeId}, ${digest}, ${user.sessionVersion}, CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "challengeId"=EXCLUDED."challengeId", "digest"=EXCLUDED."digest", "sessionVersion"=EXCLUDED."sessionVersion", "expiresAt"=EXCLUDED."expiresAt", "sentAt"=CURRENT_TIMESTAMP, "attempts"=0, "verifiedAt"=NULL, "proofDigest"=NULL, "resetAt"=NULL,
      "sendCount"=CASE WHEN "CustomerPasswordReset"."windowStart" < CURRENT_TIMESTAMP-INTERVAL '1 hour' THEN 1 ELSE "CustomerPasswordReset"."sendCount"+1 END,
      "windowStart"=CASE WHEN "CustomerPasswordReset"."windowStart" < CURRENT_TIMESTAMP-INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE "CustomerPasswordReset"."windowStart" END
    WHERE "CustomerPasswordReset"."sentAt" < CURRENT_TIMESTAMP-INTERVAL '1 minute'
      AND ("CustomerPasswordReset"."sendCount" < 5 OR "CustomerPasswordReset"."windowStart" < CURRENT_TIMESTAMP-INTERVAL '1 hour') RETURNING "userId"`;
  if (!rows.length) return challengeId;
  try { await emailDelivery.send({ to: user.email, subject: "Reset your Zera's World password", text: `Your password reset code is ${code}.\n\nIt expires in 10 minutes and works once. Do not share it. If you did not request this change, ignore this email; your password has not changed.` }, `customer-reset/${challengeId}`); }
  catch { await prisma.$executeRaw`UPDATE "CustomerPasswordReset" SET "resetAt"=CURRENT_TIMESTAMP WHERE "challengeId"=${challengeId}`; }
  return challengeId;
}
export async function verifyCustomerReset(challengeId: string, code: string) {
  const proof = randomBytes(32).toString("hex");
  const verified = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Reset[]>`SELECT * FROM "CustomerPasswordReset" WHERE "challengeId"=${challengeId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.resetAt || row.verifiedAt || row.attempts >= 5 || row.expiresAt.getTime() <= Date.now()) return false;
    await tx.$executeRaw`UPDATE "CustomerPasswordReset" SET "attempts"="attempts"+1 WHERE "challengeId"=${challengeId}`;
    if (!otpMatches(`password-reset:${challengeId}`, code, row.digest)) return false;
    const user = await tx.user.findUnique({ where: { id: row.userId } });
    if (!user || !user.isActive || user.role !== "CUSTOMER" || user.sessionVersion !== row.sessionVersion) return false;
    const digest = resetProofDigest(proof);
    await tx.$executeRaw`UPDATE "CustomerPasswordReset" SET "verifiedAt"=CURRENT_TIMESTAMP, "proofDigest"=${digest} WHERE "challengeId"=${challengeId}`;
    return true;
  });
  return verified ? proof : null;
}
export async function completeCustomerReset(challengeId: string, proof: string, passwordHash: string) {
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<Reset[]>`SELECT * FROM "CustomerPasswordReset" WHERE "challengeId"=${challengeId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.resetAt || !row.verifiedAt || row.expiresAt.getTime() <= Date.now() || row.proofDigest !== resetProofDigest(proof)) return false;
    const updated = await tx.user.updateMany({ where: { id: row.userId, isActive: true, role: "CUSTOMER", sessionVersion: row.sessionVersion }, data: { passwordHash, sessionVersion: { increment: 1 } } });
    if (updated.count !== 1) return false;
    await tx.$executeRaw`UPDATE "CustomerPasswordReset" SET "resetAt"=CURRENT_TIMESTAMP, "proofDigest"=NULL WHERE "challengeId"=${challengeId}`;
    await tx.auditLog.create({ data: { userId: row.userId, action: "CUSTOMER_PASSWORD_RESET", entityType: "User", entityId: row.userId, details: { sessionsRevoked: true } } });
    return true;
  });
}
