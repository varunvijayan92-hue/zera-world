import { z } from "zod";

export const voucherCategories = ["Courier", "Packing materials", "Stationery", "Other purchases"] as const;
export const expenseVoucherSchema = z.object({
  submissionId: z.string().uuid(),
  category: z.enum(voucherCategories),
  payee: z.string().trim().min(1, "Enter the payee.").max(120),
  reference: z.string().trim().max(100).default(""),
  paymentMethod: z.enum(["CASH", "UPI", "BANK", "CARD"]),
  paymentReference: z.string().trim().max(120).default(""),
  description: z.string().trim().min(1, "Describe the expense.").max(500),
  amount: z.number().finite().positive().max(100000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, "Use at most two decimal places."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const date = new Date(`${v}T00:00:00Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === v;
  }, "Choose a valid expense date."),
  confirmedNotRecorded: z.literal(true, { errorMap: () => ({ message: "Confirm this cost has not already been recorded." }) }),
});
export type ExpenseVoucher = z.infer<typeof expenseVoucherSchema>;
export function voucherDescription(voucher: ExpenseVoucher) {
  return [voucher.description, `Payee: ${voucher.payee}`, `Payment: ${voucher.paymentMethod}`, voucher.reference && `Bill: ${voucher.reference}`, voucher.paymentReference && `Payment reference: ${voucher.paymentReference}`].filter(Boolean).join("; ");
}
