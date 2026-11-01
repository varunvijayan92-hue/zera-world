-- Additive migration. Codes are stored as keyed digests, never plaintext.
CREATE TABLE IF NOT EXISTS "CustomerLoginChallenge" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "challengeId" TEXT NOT NULL UNIQUE,
  "digest" TEXT NOT NULL,
  "sessionVersion" INTEGER NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "sendCount" INTEGER NOT NULL DEFAULT 1,
  "consumedAt" TIMESTAMP(3)
);
