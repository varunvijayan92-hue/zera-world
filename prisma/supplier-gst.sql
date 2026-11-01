-- Supplier fields added by the recent code update. Existing records are preserved.
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "gstNumber" TEXT;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "gstRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "gstRate" DECIMAL(5,2);
ALTER TABLE "Product" ALTER COLUMN "gstRate" SET DEFAULT 5;
