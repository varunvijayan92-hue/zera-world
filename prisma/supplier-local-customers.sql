CREATE TABLE IF NOT EXISTS "SupplierLocalCustomer" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierLocalCustomer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierLocalCustomer_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "SupplierLocalCustomer_supplierId_createdAt_idx" ON "SupplierLocalCustomer"("supplierId", "createdAt");
