import { ORDER_SHIPPING_CHARGE } from "./shipping";

export function singleItemTotal(product: { sellingPrice?: unknown; gstRate?: unknown; handlingCharge?: unknown }) {
  const price = Number(product.sellingPrice ?? 0);
  const gst = Number(product.gstRate ?? 5);
  const handling = Number(product.handlingCharge ?? 0);
  if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(gst) || gst < 0 || gst > 100 || !Number.isFinite(handling) || handling < 0) return 0;
  const basePaise = Math.round(price * 100);
  return (basePaise + Math.round(basePaise * gst / 100) + Math.round(handling * 100) + ORDER_SHIPPING_CHARGE * 100) / 100;
}
