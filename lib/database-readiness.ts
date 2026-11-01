import { prisma } from "./prisma";
import { createHash } from "node:crypto";

export function databaseTargetFingerprint(connection = process.env.DATABASE_URL) {
  if (!connection) return null;
  try {
    const url = new URL(connection);
    const target = `${url.hostname.replace("-pooler.", ".")}${url.pathname}?schema=${url.searchParams.get("schema") || "public"}`;
    return createHash("sha256").update(target).digest("hex").slice(0, 16);
  } catch { return null; }
}
const required: Record<string, string[]> = {
  CustomerLoginChallenge: ["userId", "challengeId", "digest", "expiresAt", "consumedAt"],
  User: ["loginId", "sessionVersion", "language", "notificationsEnabled"],
  StoreCategory: ["imageUrl", "imagePublicId"],
  Product: ["gstRate", "handlingCharge", "returnDays", "isReturnable"],
  Supplier: ["sourceType", "pickupAddress"],
  CustomerOrder: ["customerId", "deliveredAt", "taxAmount", "handlingAmount"],
  OrderItem: ["costPrice", "gstRate", "handlingCharge", "isReturnable", "returnDays", "fulfillmentStatus"],
  ReturnRequest: ["customerId", "orderItemId", "receivedAt", "supplierReceivedAt"],
  Refund: ["gatewayRefundId"],
  CustomerAddress: ["id"], IntegrationSetting: ["id"], SupplierSettlement: ["id"], SupportTicket: ["id"], CustomerVoucher: ["id"],
};
export async function databaseSchemaReady() {
  const columns = await prisma.$queryRaw<{ table_name: string; column_name: string }[]>`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`;
  const present = new Set(columns.map((column) => `${column.table_name}.${column.column_name}`));
  return Object.entries(required).every(([table, names]) => names.every((name) => present.has(`${table}.${name}`)));
}
