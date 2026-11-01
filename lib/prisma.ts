import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ??
  new PrismaClient({
    // Route handlers log safe error codes without dumping query arguments or customer data.
    log: ["warn"],
    // Multi-record shipment/return updates need headroom for remote database latency.
    transactionOptions: { maxWait: 10000, timeout: 30000 },
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
