export function inr(value: unknown) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);
}
export function adminDate(value?: Date | string | null) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(new Date(value));
}
export function contactFromAddress(address: unknown) {
  const record = address && typeof address === "object" && !Array.isArray(address) ? address as Record<string, unknown> : {};
  const get = (key: string) => typeof record[key] === "string" ? record[key] as string : "";
  return { fullName: get("fullName"), email: get("email"), phone: get("phone"), address: ["addressLine1", "addressLine2", "city", "state", "pincode", "country"].map(get).filter(Boolean).join(", ") };
}

export function groupCheckoutCustomers(orders: { id: string; customerName: string | null; shippingAddress: unknown; createdAt: Date; totalAmount: unknown }[]) {
  const customers = new Map<string, { key: string; name: string; email: string; phone: string; orderCount: number; orderValue: number; lastOrder: Date }>();
  for (const order of orders) {
    const contact = contactFromAddress(order.shippingAddress);
    const key = contact.email.trim().toLowerCase() || contact.phone.replace(/\D/g, "") || `guest:${order.id}`;
    const current = customers.get(key);
    const latest = !current || order.createdAt >= current.lastOrder;
    customers.set(key, { key, name: latest ? contact.fullName || order.customerName || "Guest" : current.name, email: latest ? contact.email : current.email, phone: latest ? contact.phone : current.phone, orderCount: (current?.orderCount || 0) + 1, orderValue: (current?.orderValue || 0) + Number(order.totalAmount || 0), lastOrder: latest ? order.createdAt : current.lastOrder });
  }
  return [...customers.values()].sort((a, b) => b.lastOrder.getTime() - a.lastOrder.getTime());
}
