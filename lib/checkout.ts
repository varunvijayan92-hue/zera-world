type CartItem = { productId: string; sku: string; quantity: number };
type Product = {
  id: string; sku: string; status: string; sellingPrice: unknown;
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
    handlingCharges: handlingPaise / 100, shippingCharges: 120, total: (subtotalPaise + taxesPaise + handlingPaise + 12000) / 100, currency: "INR" };
}
