-- Optional product details introduced by the product page update.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "warranty" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "trend" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "inTheBox" TEXT;
