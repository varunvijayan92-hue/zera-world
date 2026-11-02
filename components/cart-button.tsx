"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { normalizeCart, readCart, writeCart } from "@/lib/cart";

export function CartButton({ product, label }: { product: { id: string; name: string; sku: string; sellingPrice?: number | string | null; imageUrls?: string[] | null }; label?: string }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const priceLabel = label ?? `Buy at ₹${Number(product.sellingPrice ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  useEffect(() => setReady(true), []);
  function selectItem() {
    try {
      const current = readCart(localStorage);
      if (current.reduce((sum, item) => sum + item.quantity, 0) >= 10) { setMessage("Your cart has reached the maximum of 10 units."); return; }
      const next = normalizeCart([...current, { ...product, quantity: 1 }]);
      if (!next.some((item) => item.id === product.id)) throw new Error("Product is unavailable.");
      writeCart(localStorage, next);
      router.push("/checkout");
    } catch {
      setMessage("Your browser could not save this item. Enable browser storage and try again.");
    }
  }
  return (
    <div className="space-y-3">
      <button type="button" disabled={!ready} onClick={selectItem} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0f2a26] disabled:opacity-50">
        {priceLabel} <ArrowRight size={16} />
      </button>
      {message ? <p role="alert" className="text-sm text-red-700">{message}</p> : null}
    </div>
  );
}
