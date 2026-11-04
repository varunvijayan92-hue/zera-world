ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'GIFT_CARD';
ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "giftCardId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentTransaction_giftCardId_fkey') THEN
    ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "CustomerVoucher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
