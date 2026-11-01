import { Resend } from "resend";

type EmailMessage = { to: string; subject: string; text: string; replyTo?: string };

type SupplierOrderItem = {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  handlingCharge: number;
  lineTotal: number;
};

type SupplierOrderTotals = {
  subtotal: number;
  taxes: number;
  handling: number;
  shipping: number;
  total: number;
};

type SupplierOrderEmailInput = {
  supplierCompany: string;
  supplierContact?: string | null;
  orderId: string;
  customer: { fullName: string; email?: string | null; phone?: string | null };
  shippingAddress?: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
    country?: string | null;
    landmark?: string | null;
  };
  items: SupplierOrderItem[];
  totals: SupplierOrderTotals;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatAddress(address?: SupplierOrderEmailInput["shippingAddress"]) {
  if (!address) return "Address not supplied";
  const parts = [address.addressLine1, address.addressLine2, address.city, address.state, address.pincode, address.country, address.landmark].filter((part): part is string => Boolean(part && part.trim()));
  return parts.length ? parts.join(", ") : "Address not supplied";
}

export function buildSupplierOrderEmailText(input: SupplierOrderEmailInput) {
  const lines = input.items.map((item) => `- ${item.quantity} x ${item.productName} (${item.sku}) @ ${formatCurrency(item.unitPrice)} each = ${formatCurrency(item.lineTotal)}`).join("\n");
  return [
    `Hello ${input.supplierContact || input.supplierCompany},`,
    "",
    `A new order has been placed for ${input.supplierCompany}.`,
    `Order: ${input.orderId}`,
    `Customer: ${input.customer.fullName}`,
    `Email: ${input.customer.email || "Not provided"}`,
    `Phone: ${input.customer.phone || "Not provided"}`,
    `Delivery address: ${formatAddress(input.shippingAddress)}`,
    "",
    "Order items:",
    lines,
    "",
    "Invoice summary:",
    `Subtotal: ${formatCurrency(input.totals.subtotal)}`,
    `GST: ${formatCurrency(input.totals.taxes)}`,
    `Handling: ${formatCurrency(input.totals.handling)}`,
    `Shipping: ${formatCurrency(input.totals.shipping)}`,
    `Total for ${input.supplierCompany}: ${formatCurrency(input.totals.total)}`,
    "",
    "Please log in to the supplier portal to review and process this order.",
  ].join("\n");
}

export const emailDelivery = {
  async send(message: EmailMessage, idempotencyKey: string) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!key || !from) throw new Error("Email delivery is not configured.");
    const result = await new Resend(key).emails.send({ from, ...message }, { idempotencyKey });
    if (result.error || !result.data?.id) throw new Error("Email could not be sent. Please try again later.");
    return result.data.id;
  },
};
