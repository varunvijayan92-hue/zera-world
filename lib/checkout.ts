import { ORDER_SHIPPING_CHARGE } from "./shipping";

type CartItem = { productId: string; sku: string; quantity: number; selectedColor?: string; selectedSize?: string };
type Product = {
  id: string; sku: string; status: string; sellingPrice: unknown; color?: string | null; size?: string | null;
  gstRate?: unknown; handlingCharge?: unknown;
  inventory: { availableQty: number; reservedQty: number; status?: string }[];
};

export function priceCheckout(cart: CartItem[], products: Product[]) {
  const lookup = new Map(products.map((product) => [product.id, product]));
  if (!cart.length || new Set(cart.map((item) => item.productId)).size !== cart.length) {
    throw new Error("Cart must contain distinct products.");
  }
  if (cart.reduce((sum, item) => sum + item.quantity, 0) > 10) throw new Error("Requested quantity exceeds the cart limit of 10 units.");
  let subtotalPaise = 0; let taxesPaise = 0; let handlingPaise = 0;
  for (const item of cart) {
    const product = lookup.get(item.productId);
    if (!product || product.status !== "ACTIVE" || product.sku !== item.sku) {
      throw new Error("One or more products are no longer available. Refresh your cart.");
    }
    for (const [configured, selected] of [[product.color, item.selectedColor], [product.size, item.selectedSize]]) {
      const choices = (configured || "").split(",").map(value => value.trim()).filter(Boolean);
      if ((choices.length && (!selected || !choices.includes(selected))) || (!choices.length && selected)) throw new Error("One or more product options have changed. Please choose colour and size again.");
    }
    const price = Number(product.sellingPrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Product price is unavailable.");
    const stock = product.inventory.filter((row) => row.status === undefined || row.status === "AVAILABLE").reduce((sum, row) => sum + Math.max(0, row.availableQty - row.reservedQty), 0);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 10 || stock < item.quantity) {
      throw new Error("Requested quantity is unavailable.");
    }
    const line = Math.round(price * 100) * item.quantity;
    const gst = Number(product.gstRate ?? 5); const handling = Number(product.handlingCharge ?? 0);
    if (!Number.isFinite(gst) || gst < 0 || gst > 100 || !Number.isFinite(handling) || handling < 0) throw new Error("Product price configuration is unavailable.");
    subtotalPaise += line; taxesPaise += Math.round(line * gst / 100);
    handlingPaise += Math.round(handling * 100) * item.quantity;
  }

  return { subtotal: subtotalPaise / 100, taxes: taxesPaise / 100,
    handlingCharges: handlingPaise / 100, shippingCharges: ORDER_SHIPPING_CHARGE, total: (subtotalPaise + taxesPaise + handlingPaise + ORDER_SHIPPING_CHARGE * 100) / 100, currency: "INR" };
}
