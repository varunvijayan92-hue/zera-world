DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'Supplier' AND column_name = 'codHandling') THEN
    ALTER TABLE "Supplier" ADD COLUMN "codHandling" TEXT NOT NULL DEFAULT 'NONE';
    UPDATE "Supplier" SET "codHandling" = 'OWN_COURIER' WHERE "sourceType" = 'DIRECT';
  END IF;
END $$;
