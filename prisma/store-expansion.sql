-- Review and approve before running against production. One-time additive upgrade.
BEGIN;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "CustomerOrder" ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "handlingAmount" DECIMAL(12,2),
ADD COLUMN     "taxAmount" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "costPrice" DECIMAL(12,2),
ADD COLUMN     "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "gstRate" DECIMAL(5,2),
ADD COLUMN     "handlingCharge" DECIMAL(12,2),
ADD COLUMN     "isReturnable" BOOLEAN,
ADD COLUMN     "returnDays" INTEGER;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 5,
ADD COLUMN     "handlingCharge" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "isReturnable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "returnDays" INTEGER NOT NULL DEFAULT 7;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "gatewayRefundId" TEXT;

-- AlterTable
ALTER TABLE "ReturnRequest" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "orderItemId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "returnType" TEXT NOT NULL DEFAULT 'CUSTOMER_RETURN',
ADD COLUMN     "supplierReceivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "StoreCategory" ADD COLUMN     "imagePublicId" TEXT,
ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "pickupAddress" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "phone" TEXT;

-- CreateTable
CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Home',
    "address" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationSetting" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedCredentials" TEXT NOT NULL,
    "options" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSettlement" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reply" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerVoucher" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerVoucher_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerAddress_userId_idx" ON "CustomerAddress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationSetting_provider_key" ON "IntegrationSetting"("provider");

-- CreateIndex
CREATE INDEX "SupplierSettlement_supplierId_paidAt_idx" ON "SupplierSettlement"("supplierId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSettlement_supplierId_reference_key" ON "SupplierSettlement"("supplierId", "reference");

-- CreateIndex
CREATE INDEX "SupportTicket_userId_createdAt_idx" ON "SupportTicket"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerVoucher_code_key" ON "CustomerVoucher"("code");

-- CreateIndex
CREATE INDEX "CustomerVoucher_customerId_idx" ON "CustomerVoucher"("customerId");

-- CreateIndex
CREATE INDEX "CustomerOrder_customerId_createdAt_idx" ON "CustomerOrder"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gatewayRefundId_key" ON "Refund"("gatewayRefundId");

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSettlement" ADD CONSTRAINT "SupplierSettlement_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerVoucher" ADD CONSTRAINT "CustomerVoucher_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
