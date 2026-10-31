type CartItem = { productId: string; sku: string; quantity: number };
type Product = {
  id: string; sku: string; status: string; sellingPrice: unknown;
  inventory: { availableQty: number; reservedQty: number }[];
};

export function priceCheckout(cart: CartItem[], products: Product[]) {
  const lookup = new Map(products.map((product) => [product.id, product]));
  if (!cart.length || new Set(cart.map((item) => item.productId)).size !== cart.length) {
    throw new Error("Cart must contain distinct products.");
  }
  let subtotalPaise = 0;
  for (const item of cart) {
    const product = lookup.get(item.productId);
    if (!product || product.status !== "ACTIVE" || product.sku !== item.sku) {
      throw new Error("One or more products are no longer available. Refresh your cart.");
    }
    const price = Number(product.sellingPrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Product price is unavailable.");
    const stock = product.inventory.reduce((sum, row) => sum + Math.max(0, row.availableQty - row.reservedQty), 0);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50 || stock < item.quantity) {
      throw new Error("Requested quantity is unavailable.");
    }
    subtotalPaise += Math.round(price * 100) * item.quantity;
  }
  const taxesPaise = Math.round(subtotalPaise * 0.05);
  return { subtotal: subtotalPaise / 100, taxes: taxesPaise / 100,
    shippingCharges: 120, total: (subtotalPaise + taxesPaise + 12000) / 100, currency: "INR" };
}
