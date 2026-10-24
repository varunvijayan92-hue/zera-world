"use client";

import { ShoppingBag } from "lucide-react";
import { useState } from "react";

export function CartButton({ product }: { product: { id: string; name: string; sku: string; sellingPrice?: number | string | null; imageUrls?: string[] | null } }) {
  const [message, setMessage] = useState("");

  function addToCart() {
    const currentCart = JSON.parse(localStorage.getItem("zeraworld-cart") || "[]");
    const nextCart = [...currentCart, { ...product, quantity: 1, addedAt: new Date().toISOString() }];
    localStorage.setItem("zeraworld-cart", JSON.stringify(nextCart));
    setMessage("Added to cart");
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={addToCart}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2a26]"
      >
        <ShoppingBag size={16} />
        Add to cart
      </button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
    </div>
  );
}
