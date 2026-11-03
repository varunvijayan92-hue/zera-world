import type { Prisma } from "@prisma/client";

type CodProduct = { codAvailable?: boolean; supplierId?: string | null; supplier?: { status: string; sourceType: string } | null };
export function cashOnDeliveryAvailable(products: CodProduct[]) {
  return products.length > 0 && products.every(product => product.codAvailable === true && !!product.supplierId && product.supplier?.status === "ACTIVE" && product.supplier.sourceType === "DIRECT");
}

export function fulfilmentPaymentWhere(orderId: string): Prisma.PaymentTransactionWhereInput {
  return { orderId, OR: [{ paymentStatus: "PAID" }, { provider: "COD", paymentStatus: "PENDING" }] };
}

export const COD_REQUEST_KEY = "zeraworld-cod-request";

export function codShippingShare(shippingAmount: unknown, supplierIds: Iterable<string>, supplierId: string) {
  const ids = [...new Set(supplierIds)].sort();
  const index = ids.indexOf(supplierId);
  if (index < 0) return 0;
  const paise = Math.round(Number(shippingAmount || 0) * 100);
  return (Math.floor(paise / ids.length) + (index < paise % ids.length ? 1 : 0)) / 100;
}

export function supplierCodTotal(order: { shippingAmount: unknown; orderItems: { supplierId: string | null; quantity: number; unitPrice: unknown; gstRate: unknown; handlingCharge: unknown }[] }, supplierId: string) {
  const supplierIds = order.orderItems.map(item => item.supplierId).filter((id): id is string => !!id);
  const itemPaise = order.orderItems.filter(item => item.supplierId === supplierId).reduce((sum, item) => {
    const line = Math.round(Number(item.unitPrice || 0) * 100) * item.quantity;
    return sum + line + Math.round(line * Number(item.gstRate || 0) / 100) + Math.round(Number(item.handlingCharge || 0) * 100) * item.quantity;
  }, 0);
  return (itemPaise + Math.round(codShippingShare(order.shippingAmount, supplierIds, supplierId) * 100)) / 100;
}
