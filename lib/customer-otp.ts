import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { emailDelivery } from "./email";

export const OTP_COOKIE = "zera_customer_otp";
export const OTP_TTL_SECONDS = 600;
export function otpDigest(challengeId: string, code: string) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`customer-login:${challengeId}:${code}`).digest("hex");
}
export function otpMatches(challengeId: string, code: string, digest: string) {
  const actual = Buffer.from(otpDigest(challengeId, code), "hex");
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
type Challenge = { userId: string; challengeId: string; digest: string; sessionVersion: number; attempts: number; expiresAt: Date; consumedAt: Date | null };

export async function issueCustomerOtp(user: { id: string; email: string; sessionVersion: number }) {
  const challengeId = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const digest = otpDigest(challengeId, code);
  // A shared database guard applies across Vercel instances: one send/minute, five/hour per account.
  const issued = await prisma.$queryRaw<{ userId: string }[]>`
    INSERT INTO "CustomerLoginChallenge" ("userId", "challengeId", "digest", "sessionVersion", "expiresAt", "sentAt", "windowStart")
    VALUES (${user.id}, ${challengeId}, ${digest}, ${user.sessionVersion}, CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET
      "challengeId" = EXCLUDED."challengeId", "digest" = EXCLUDED."digest", "sessionVersion" = EXCLUDED."sessionVersion",
      "attempts" = 0, "expiresAt" = EXCLUDED."expiresAt", "sentAt" = CURRENT_TIMESTAMP, "consumedAt" = NULL,
      "sendCount" = CASE WHEN "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE "CustomerLoginChallenge"."sendCount" + 1 END,
      "windowStart" = CASE WHEN "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE "CustomerLoginChallenge"."windowStart" END
    WHERE "CustomerLoginChallenge"."sentAt" < CURRENT_TIMESTAMP - INTERVAL '1 minute'
      AND ("CustomerLoginChallenge"."sendCount" < 5 OR "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour')
    RETURNING "userId"`;
  if (!issued.length) return null;
  try {
    await emailDelivery.send({ to: user.email, subject: "Your Zera's World sign-in code", text: `Your Zera's World one-time sign-in code is ${code}.\n\nIt expires in 10 minutes and can only be used once. Do not share this code. If you did not request it, you can ignore this email.` }, `customer-login/${challengeId}`);
  } catch {
    await prisma.$executeRaw`UPDATE "CustomerLoginChallenge" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "challengeId" = ${challengeId}`;
    throw new Error("The verification email could not be sent. Wait a minute and try again.");
  }
  return challengeId;
}

export async function consumeCustomerOtp(challengeId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Challenge[]>`SELECT * FROM "CustomerLoginChallenge" WHERE "challengeId" = ${challengeId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.consumedAt || row.attempts >= 5 || row.expiresAt.getTime() <= Date.now()) return null;
    await tx.$executeRaw`UPDATE "CustomerLoginChallenge" SET "attempts" = "attempts" + 1 WHERE "challengeId" = ${challengeId}`;
    if (!otpMatches(challengeId, code, row.digest)) return null;
    const user = await tx.user.findUnique({ where: { id: row.userId } });
    if (!user || !user.isActive || user.role !== "CUSTOMER" || user.sessionVersion !== row.sessionVersion) return null;
    await tx.$executeRaw`UPDATE "CustomerLoginChallenge" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "challengeId" = ${challengeId}`;
    return user;
  });
}
