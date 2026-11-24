CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT PRIMARY KEY,
  "thread" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "peer" TEXT NOT NULL,
  "senderId" TEXT,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "externalId" TEXT,
  "actorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SupportMessage_thread_createdAt_idx" ON "SupportMessage" ("thread", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportMessage_createdAt_idx" ON "SupportMessage" ("createdAt");
