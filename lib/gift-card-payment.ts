import type { Prisma } from "@prisma/client";
import { AccessError } from "./portal-access";

export async function debitGiftCard(tx: Prisma.TransactionClient, customerId: string, code: string, amount: number) {
  const card = await tx.customerVoucher.findFirst({ where: { customerId, code, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
  if (!card) throw new AccessError("A valid gift card for this account was not found.");
  if (Math.round(Number(card.balance) * 100) < Math.round(amount * 100)) throw new AccessError("This gift card must cover the full order total. Choose another card or payment method.");
  const updated = await tx.customerVoucher.updateMany({ where: { id: card.id, customerId, balance: { gte: amount.toFixed(2) }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, data: { balance: { decrement: amount.toFixed(2) } } });
  if (updated.count !== 1) throw new AccessError("Gift-card balance changed. Please review your card and retry.", 409);
  return card.id;
}
