import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

/** Called inside the same transaction that marks a Razorpay payment as paid. */
export async function queuePaidCjOrder(tx: Prisma.TransactionClient, orderId: string) {
  const item = await tx.orderItem.findFirst({
    where: { customerOrderId: orderId, product: { supplier: { provider: "CJ_DROPSHIPPING" } } },
    select: { id: true },
  });
  if (!item) return;
  const id = `cj_${createHash("sha256").update(orderId).digest("hex")}`;
  await tx.syncJob.upsert({
    where: { id },
    create: { id, jobType: "CJ_PAID_ORDER", metadata: { orderId } },
    update: {},
  });
}
