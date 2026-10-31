export function nextPaymentStatus(current: string, event: string) {
  if (["REFUNDED", "PARTIALLY_REFUNDED", "CANCELLED"].includes(current)) return null;
  if (current === "PAID") return null;
  if (event === "payment.captured") return "PAID" as const;
  if (event === "payment.authorized") return "AUTHORIZED" as const;
  if (event === "payment.failed" && current !== "AUTHORIZED") return "FAILED" as const;
  return null;
}

export function paymentMatches(transaction: { amount: unknown; currency: string; gatewayPaymentId: string | null; paymentStatus?: string },
  payment: { id: string; amount?: number; currency?: string }) {
  return Number.isSafeInteger(payment.amount) && payment.amount === Math.round(Number(transaction.amount) * 100)
    && payment.currency === transaction.currency
    && (!transaction.gatewayPaymentId || transaction.gatewayPaymentId === payment.id
      || transaction.paymentStatus === "FAILED");
}
