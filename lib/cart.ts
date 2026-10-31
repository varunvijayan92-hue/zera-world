import { z } from "zod";

export const CART_KEY = "zeraworld-cart";
export const cartItemSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), sku: z.string().min(1),
  sellingPrice: z.coerce.number().finite().nonnegative(),
  quantity: z.number().int().min(1).max(50).default(1),
  imageUrls: z.array(z.string()).nullable().optional(),
});
export type CartItem = z.infer<typeof cartItemSchema>;

export function normalizeCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  const items = new Map<string, CartItem>();
  for (const raw of value.slice(0, 100)) {
    const parsed = cartItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;
    const previous = items.get(item.id);
    items.set(item.id, { ...item, quantity: Math.min(50, (previous?.quantity || 0) + item.quantity) });
  }
  return [...items.values()];
}

export function readCart(storage: Pick<Storage, "getItem">): CartItem[] {
  try { return normalizeCart(JSON.parse(storage.getItem(CART_KEY) || "[]")); } catch { return []; }
}

export function writeCart(storage: Pick<Storage, "setItem">, items: CartItem[]) {
  storage.setItem(CART_KEY, JSON.stringify(items));
}
