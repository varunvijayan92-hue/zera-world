import { codShippingShare } from "./cash-on-delivery";
type BillItem = { quantity: number; unitPrice: unknown; gstRate: unknown; handlingCharge: unknown };
export function shipmentBill(items: BillItem[], shipping: number) {
  let subtotal = 0, gst = 0, handling = 0;
  for (const item of items) {
    const line = Math.round(Number(item.unitPrice || 0) * 100) * item.quantity;
    subtotal += line;
    gst += Math.round(line * Number(item.gstRate || 0) / 100);
    handling += Math.round(Number(item.handlingCharge || 0) * 100) * item.quantity;
  }
  return { subtotal: subtotal / 100, gst: gst / 100, handling: handling / 100, shipping, total: (subtotal + gst + handling + Math.round(shipping * 100)) / 100 };
}
export function supplierShipmentBill(items: (BillItem & { supplierId: string | null })[], shipping: unknown, supplierId: string) {
  return shipmentBill(items.filter(item => item.supplierId === supplierId), codShippingShare(shipping, items.map(item => item.supplierId).filter((id): id is string => !!id), supplierId));
}
