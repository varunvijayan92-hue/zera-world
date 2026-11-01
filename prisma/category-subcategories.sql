-- Existing categories remain top-level. Product assignments and images are preserved.
ALTER TABLE "StoreCategory" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StoreCategory_parentId_fkey' AND conrelid = '"StoreCategory"'::regclass) THEN
    ALTER TABLE "StoreCategory" ADD CONSTRAINT "StoreCategory_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "StoreCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "StoreCategory_parentId_idx" ON "StoreCategory"("parentId");
