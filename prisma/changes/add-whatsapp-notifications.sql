BEGIN;
CREATE TABLE IF NOT EXISTS "CustomerWhatsAppPreference" (
  "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
  "enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "WhatsAppNotification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "orderId" TEXT NOT NULL REFERENCES "CustomerOrder"("id") ON DELETE CASCADE,
  "event" TEXT NOT NULL,
  "reference" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "requestId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WhatsAppNotification_status_createdAt_idx" ON "WhatsAppNotification"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppNotification_orderId_idx" ON "WhatsAppNotification"("orderId");
COMMIT;
