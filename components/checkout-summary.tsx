import { Check, ShieldCheck } from "lucide-react";
import type { CheckoutDraft } from "@/lib/checkout-storage";

export function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(value);
}

export function CheckoutProgress({ step }: { step: 1 | 2 }) {
  return <ol aria-label="Checkout steps" className="mb-8 flex items-center gap-3 text-sm font-semibold">
    <li aria-current={step === 1 ? "step" : undefined} className="flex items-center gap-2 text-[#173B35]">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#173B35] text-white">{step === 2 ? <Check size={16} /> : "1"}</span> Items & delivery
    </li>
    <li aria-hidden="true" className="h-px w-8 bg-[#173B35]/20" />
    <li aria-current={step === 2 ? "step" : undefined} className={`flex items-center gap-2 ${step === 2 ? "text-[#173B35]" : "text-[#173B35]/50"}`}>
      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${step === 2 ? "bg-[#173B35] text-white" : "border border-[#173B35]/20"}`}>2</span> Payment
    </li>
  </ol>;
}

export function CheckoutSummary({ amount }: { amount: CheckoutDraft["amount"] | null }) {
  return <div className="space-y-3">
    <h2 className="text-xl font-bold">Order amount</h2>
    {amount ? <>
      <dl className="space-y-2 text-sm text-[#173B35]/70">
        <div className="flex justify-between"><dt>Items subtotal</dt><dd>{money(amount.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Delivery</dt><dd>{money(amount.shippingCharges)}</dd></div>
        {amount.taxes > 0 ? <div className="flex justify-between"><dt>GST</dt><dd>{money(amount.taxes)}</dd></div> : null}
        {(amount.handlingCharges || 0) > 0 ? <div className="flex justify-between"><dt>Handling</dt><dd>{money(amount.handlingCharges || 0)}</dd></div> : null}
      </dl>
      <div className="flex items-center justify-between border-t border-[#173B35]/10 pt-4"><span className="font-semibold">Total to pay</span><strong className="text-2xl">{money(amount.total)}</strong></div>
    </> : <p role="status" className="py-4 text-sm text-[#173B35]/70">Checking the latest prices and available quantity…</p>}
    <p className="flex items-center gap-2 pt-2 text-xs text-[#173B35]/60"><ShieldCheck size={15} /> Payments secured by Razorpay</p>
  </div>;
}
