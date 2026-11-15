export function whatsappTemplateTitle(name: string) {
  if (name.includes("payment")) return "Payment received";
  if (name.includes("shipped")) return "On its way";
  if (name.includes("delivered")) return "Order delivered";
  if (name.includes("order_placed")) return "Order confirmed";
  return name.replaceAll("_", " ").replace(/^./, value => value.toUpperCase());
}

export function whatsappTestVariables(name: string, count: number, examples: string[] = []) {
  const sample = name.includes("payment") ? "1.00 (TEST ONLY; no payment collected)"
    : name.includes("shipped") ? "TEST ONLY: Demo order TEST-1001 is on its way. Courier: Demo courier. Tracking: DEMO-TRACKING-001. No parcel has been dispatched."
    : name.includes("delivered") ? "TEST ONLY: Demo order TEST-1001, total INR 1.00. This is a delivery preview; no real order has been delivered."
    : "TEST ONLY: Demo order TEST-1001, total INR 1.00. This is a preview; no order or payment has been created.";
  return Array.from({ length: count }, (_, index) => index === 0 ? sample : examples[index] || `Test value ${index + 1}`);
}

export function renderWhatsAppPreview(body: string, variables: string[]) {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, index: string) => variables[Number(index) - 1] || match);
}

export function normalizeWhatsAppTestRecipient(value: string) {
  const digits = value.trim().replace(/[\s()+-]/g, "").replace(/^91(?=\d{10}$)/, "");
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}
