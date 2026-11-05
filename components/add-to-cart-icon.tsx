"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";
import { MAX_CART_UNITS, cartItemSchema, normalizeCart, readCart, writeCart } from "@/lib/cart";

export function AddToCartIcon({ product }: { product: { id: string; name: string; sku: string; sellingPrice: number; imageUrls?: string[] | null } }) {
  const [message, setMessage] = useState("");

  function addToCart() {
    try {
      const current = readCart(localStorage);
      if (current.reduce((sum, item) => sum + item.quantity, 0) >= MAX_CART_UNITS) {
        setMessage("Your cart has reached the maximum of 10 units.");
        return;
      }
      const parsed = cartItemSchema.safeParse({ ...product, quantity: 1 });
      if (!parsed.success || product.sellingPrice <= 0) {
        setMessage("This product is unavailable.");
        return;
      }
      writeCart(localStorage, normalizeCart([...current, parsed.data]));
      setMessage("Added to cart.");
    } catch {
      setMessage("Could not add to cart. Please try again.");
    }
  }

  return <div className="text-right"><button type="button" className="tokoo-mini-cart" aria-label={`Add ${product.name} to cart`} onClick={addToCart}><ShoppingBag size={16} aria-hidden="true" /></button>{message ? <p role="status" className="mt-2 max-w-40 text-xs font-medium text-[#173B35]">{message}</p> : null}</div>;
}
