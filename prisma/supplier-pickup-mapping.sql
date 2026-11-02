-- Keep supplier pickup mappings separate from historical shipment snapshots.
ALTER TABLE "Supplier" ADD COLUMN IF NOT EXISTS "shiprocketPickupLocation" TEXT;
ALTER TABLE "Shipment" ADD COLUMN IF NOT EXISTS "pickupLocation" TEXT;
