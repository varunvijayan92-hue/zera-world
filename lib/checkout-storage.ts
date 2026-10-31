import { z } from "zod";
import { cartItemSchema } from "./cart";
import { checkoutAddressSchema } from "./validators";

export type DeliveryAddress = z.infer<typeof checkoutAddressSchema>;
export const emptyAddress: DeliveryAddress = {
  fullName: "", email: "", phone: "", addressLine1: "", addressLine2: "",
  city: "", state: "", pincode: "", country: "India", landmark: "",
};
export const SAVED_ADDRESS_KEY = "zeraworld-saved-address";
export const CHECKOUT_DRAFT_KEY = "zeraworld-checkout-draft";
export const amountSchema = z.object({
  subtotal: z.number().nonnegative(), taxes: z.number().nonnegative(),
  handlingCharges: z.number().nonnegative().default(0),
  shippingCharges: z.number().nonnegative(), total: z.number().positive(), currency: z.literal("INR"),
});
export const draftSchema = z.object({
  items: z.array(cartItemSchema).min(1), shippingAddress: checkoutAddressSchema,
  amount: amountSchema, createdAt: z.number(),
});
export type CheckoutDraft = z.infer<typeof draftSchema>;

function readJson(storage: Pick<Storage, "getItem">, key: string) {
  try { return JSON.parse(storage.getItem(key) || "null") as unknown; } catch { return null; }
}

export function readSavedAddress(storage: Pick<Storage, "getItem">): DeliveryAddress | null {
  const result = checkoutAddressSchema.safeParse(readJson(storage, SAVED_ADDRESS_KEY));
  return result.success ? result.data : null;
}

export function rememberAddress(storage: Pick<Storage, "setItem">, address: DeliveryAddress, remember: boolean) {
  if (remember) storage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(checkoutAddressSchema.parse(address)));
}

export function readCheckoutDraft(storage: Pick<Storage, "getItem">, now = Date.now()): CheckoutDraft | null {
  const result = draftSchema.safeParse(readJson(storage, CHECKOUT_DRAFT_KEY));
  if (!result.success || now - result.data.createdAt > 30 * 60 * 1000 || result.data.createdAt > now + 60000) return null;
  return result.data;
}
