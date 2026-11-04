import { z } from "zod";

export const giftCardSchema = z.object({
  customerEmail: z.string().trim().email().max(254).transform(value => value.toLowerCase()),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9][A-Z0-9-]{7,39}$/, "Use 8–40 letters, numbers or hyphens for the code."),
  amount: z.number().finite().min(0.01).max(100000).refine(value => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001, "Use no more than two decimal places."),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

export function giftCardExpiry(value?: string, now = Date.now()) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw Error("Choose a valid expiry date.");
  const calendar = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== value) throw Error("Choose a valid expiry date.");
  const expiry = new Date(`${value}T23:59:59.999+05:30`);
  if (expiry.getTime() <= now) throw Error("Expiry must be today or a future date.");
  return expiry;
}

export function giftCardStatus(card: { balance: unknown; expiresAt: Date | string | null }, now = Date.now()) {
  if (card.expiresAt && new Date(card.expiresAt).getTime() <= now) return "Expired";
  return Number(card.balance) > 0 ? "Issued" : "No balance";
}
