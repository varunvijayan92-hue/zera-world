import { z } from "zod";

export const cjOrderPolicySchema = z.object({
  origin: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Enter the two-letter warehouse country code."),
  trackedMethods: z.array(z.string().trim().min(1).max(100)).max(30).refine(values => new Set(values).size === values.length, "Remove duplicate shipping methods."),
});

export function cheapestApprovedCjMethod(quotes: { name: string; usd: number }[], trackedMethods: string[]) {
  const allowed = new Set(trackedMethods);
  return quotes.filter(quote => allowed.has(quote.name) && Number.isFinite(quote.usd) && quote.usd >= 0)
    .reduce<{ name: string; usd: number } | null>((best, quote) => !best || quote.usd < best.usd ? quote : best, null);
}
