import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { emailDelivery } from "./email";
import { customerWhatsAppPhone } from "./customer-whatsapp";
import { sendWhatsAppSignupCode } from "./whatsapp";

export const OTP_COOKIE = "zera_customer_otp";
export const OTP_TTL_SECONDS = 600;
export function otpDigest(challengeId: string, code: string, binding = "") {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured.");
  return createHmac("sha256", secret).update(`customer-login:${challengeId}:${code}${binding ? `:${binding}` : ""}`).digest("hex");
}
export function otpMatches(challengeId: string, code: string, digest: string, binding = "") {
  const actual = Buffer.from(otpDigest(challengeId, code, binding), "hex");
  const expected = Buffer.from(digest, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
type Challenge = { userId: string; challengeId: string; digest: string; sessionVersion: number; attempts: number; expiresAt: Date; consumedAt: Date | null; purpose?: string };

type OtpUser = { id: string; email: string; sessionVersion: number; phone?: string | null };
type OtpPurpose = "LOGIN" | "REGISTER" | "REGISTER_WHATSAPP" | "REGISTER_EMAIL";

async function reserveWhatsAppSend(phone: string) {
  const recipient = otpDigest("registration-recipient", phone);
  const rows = await prisma.$queryRaw<{ recipient: string }[]>`
    INSERT INTO "CustomerWhatsAppOtpRate" ("recipient", "windowStart", "lastSentAt", "sends")
    VALUES (${recipient}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
    ON CONFLICT ("recipient") DO UPDATE SET
      "lastSentAt" = CURRENT_TIMESTAMP,
      "sends" = CASE WHEN "CustomerWhatsAppOtpRate"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE "CustomerWhatsAppOtpRate"."sends" + 1 END,
      "windowStart" = CASE WHEN "CustomerWhatsAppOtpRate"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE "CustomerWhatsAppOtpRate"."windowStart" END
    WHERE "CustomerWhatsAppOtpRate"."lastSentAt" < CURRENT_TIMESTAMP - INTERVAL '1 minute'
      AND ("CustomerWhatsAppOtpRate"."sends" < 5 OR "CustomerWhatsAppOtpRate"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour')
    RETURNING "recipient"`;
  return rows.length > 0;
}

export async function issueCustomerOtp(user: OtpUser, purpose: OtpPurpose = "LOGIN", previousChallengeId?: string) {
  const registration = purpose === "REGISTER_WHATSAPP" || purpose === "REGISTER_EMAIL";
  const phone = registration ? customerWhatsAppPhone.parse(user.phone) : "";
  if (purpose === "REGISTER_WHATSAPP" && !await reserveWhatsAppSend(phone)) return null;
  if (purpose === "REGISTER_EMAIL" && !previousChallengeId) throw new Error("WhatsApp verification is required.");
  const challengeId = randomBytes(32).toString("hex");
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  const digest = otpDigest(challengeId, code, registration ? `${purpose}:${phone}` : "");
  // A shared database guard applies across Vercel instances: one send/minute, five/hour per account.
  const issued = await prisma.$queryRaw<{ userId: string }[]>`
    INSERT INTO "CustomerLoginChallenge" ("userId", "challengeId", "digest", "sessionVersion", "purpose", "expiresAt", "sentAt", "windowStart")
    SELECT ${user.id}, ${challengeId}, ${digest}, ${user.sessionVersion}, ${purpose}, CURRENT_TIMESTAMP + INTERVAL '10 minutes', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    WHERE ${purpose} <> 'REGISTER_EMAIL' OR EXISTS (
      SELECT 1 FROM "CustomerLoginChallenge"
      WHERE "userId" = ${user.id} AND "challengeId" = ${previousChallengeId || ""} AND "purpose" = 'REGISTER_WHATSAPP' AND "consumedAt" IS NOT NULL
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "challengeId" = EXCLUDED."challengeId", "digest" = EXCLUDED."digest", "sessionVersion" = EXCLUDED."sessionVersion",
      "purpose" = EXCLUDED."purpose",
      "attempts" = 0, "expiresAt" = EXCLUDED."expiresAt", "sentAt" = CURRENT_TIMESTAMP, "consumedAt" = NULL,
      "sendCount" = CASE WHEN "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN 1 ELSE "CustomerLoginChallenge"."sendCount" + 1 END,
      "windowStart" = CASE WHEN "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour' THEN CURRENT_TIMESTAMP ELSE "CustomerLoginChallenge"."windowStart" END
    WHERE (${purpose} = 'REGISTER_EMAIL'
      AND "CustomerLoginChallenge"."challengeId" = ${previousChallengeId || ""}
      AND "CustomerLoginChallenge"."purpose" = 'REGISTER_WHATSAPP'
      AND "CustomerLoginChallenge"."consumedAt" IS NOT NULL)
      OR (${purpose} <> 'REGISTER_EMAIL' AND "CustomerLoginChallenge"."sentAt" < CURRENT_TIMESTAMP - INTERVAL '1 minute'
      AND ("CustomerLoginChallenge"."sendCount" < 5 OR "CustomerLoginChallenge"."windowStart" < CURRENT_TIMESTAMP - INTERVAL '1 hour'))
    RETURNING "userId"`;
  if (!issued.length) return null;
  try {
    if (purpose === "REGISTER_WHATSAPP") await sendWhatsAppSignupCode(phone, code);
    else await emailDelivery.send({ to: user.email, subject: "Your Zera's World verification code", text: `Your Zera's World one-time verification code is ${code}.\n\nIt expires in 10 minutes and can only be used once. Do not share this code. If you did not request it, you can ignore this email.` }, `customer-login/${challengeId}`);
  } catch {
    await prisma.$executeRaw`UPDATE "CustomerLoginChallenge" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "challengeId" = ${challengeId}`;
    throw new Error(purpose === "REGISTER_WHATSAPP" ? "The WhatsApp verification code could not be sent." : "The verification email could not be sent. Wait a minute and try again.");
  }
  return challengeId;
}

export async function consumeCustomerOtp(challengeId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Challenge[]>`SELECT * FROM "CustomerLoginChallenge" WHERE "challengeId" = ${challengeId} FOR UPDATE`;
    const row = rows[0];
    if (!row || row.consumedAt || row.attempts >= 5 || row.expiresAt.getTime() <= Date.now()) return null;
    await tx.$executeRaw`UPDATE "CustomerLoginChallenge" SET "attempts" = "attempts" + 1 WHERE "challengeId" = ${challengeId}`;
    const purpose = row.purpose || "LOGIN";

    const registration = purpose === "REGISTER_WHATSAPP" || purpose === "REGISTER_EMAIL";
    const user = await tx.user.findUnique({ where: { id: row.userId } });
    if (!user || user.role !== "CUSTOMER" || user.sessionVersion !== row.sessionVersion || user.isActive === (registration || purpose === "REGISTER")) return null;
    if (registration && !user.phone) return null;
    if (!otpMatches(challengeId, code, row.digest, registration ? `${purpose}:${user.phone}` : "")) return null;
    if (purpose === "REGISTER") {
      const changed = await tx.user.updateMany({ where: { id: user.id, isActive: false, sessionVersion: row.sessionVersion }, data: { isActive: true } });
      if (!changed.count) return null;
    }
    if (registration) {
      if (purpose === "REGISTER_EMAIL" && !user.phoneVerifiedAt) return null;
      const changed = await tx.user.updateMany({
        where: { id: user.id, isActive: false, phone: user.phone, sessionVersion: row.sessionVersion },
        data: purpose === "REGISTER_WHATSAPP" ? { phoneVerifiedAt: new Date() } : { isActive: true },
      });
      if (!changed.count) return null;
    }
    await tx.$executeRaw`UPDATE "CustomerLoginChallenge" SET "consumedAt" = CURRENT_TIMESTAMP WHERE "challengeId" = ${challengeId}`;
    return { ...user, otpPurpose: purpose };
  });
}
