import { z } from "zod";

const money = z.number().finite().min(0).max(9999999999.99);
export const mobilePricingSchema = z.object({
  costPrice: money.optional(),
  usdCost: money.optional(),
  exchangeRate: z.number().finite().positive().max(10000).optional(),
  markupPercent: z.number().finite().min(0).max(10000).optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.costPrice === undefined) === (value.usdCost === undefined)) {
    ctx.addIssue({ code: "custom", message: "Provide either costPrice (INR) or usdCost." });
  }
  if (value.usdCost !== undefined && value.exchangeRate === undefined) {
    ctx.addIssue({ code: "custom", message: "An exchangeRate is required for USD conversion." });
  }
});

export function calculateMobilePricing(input: unknown) {
  const value = mobilePricingSchema.parse(input);
  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON * amount) * 100) / 100;
  const costPrice = roundMoney(value.usdCost !== undefined ? value.usdCost * value.exchangeRate! : value.costPrice!);
  const sellingPrice = value.markupPercent === undefined ? undefined : roundMoney(costPrice * (1 + value.markupPercent / 100));
  if (costPrice > 9999999999.99 || (sellingPrice !== undefined && sellingPrice > 9999999999.99)) {
    throw new Error("Calculated price exceeds the supported maximum.");
  }
  return { currency: "INR", costPrice, ...(sellingPrice === undefined ? {} : { sellingPrice }), markupPercent: value.markupPercent };
}
