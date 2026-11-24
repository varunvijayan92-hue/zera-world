ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);
CREATE TABLE IF NOT EXISTS "CustomerWhatsAppOtpRate" (
  "recipient" TEXT PRIMARY KEY,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "lastSentAt" TIMESTAMP(3) NOT NULL,
  "sends" INTEGER NOT NULL
);
