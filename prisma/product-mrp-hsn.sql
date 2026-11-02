-- Optional fields: existing prices and products are preserved.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "mrp" DECIMAL(12,2);
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "hsnCode" TEXT;
