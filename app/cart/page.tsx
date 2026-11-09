"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductImage } from "@/components/product-image";
import { CheckoutSummary } from "@/components/checkout-summary";
import type { CheckoutDraft } from "@/lib/checkout-storage";
import { readCart, writeCart } from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<Array<{ id: string; name: string; sku: string; sellingPrice?: number | string | null; quantity?: number; selectedColor?: string; selectedSize?: string; imageUrls?: string[] | null }>>([]);

  useEffect(() => {
    const stored = readCart(localStorage);
    setItems(stored);
  }, []);

  const [quote, setQuote] = useState<{ fingerprint: string; amount: CheckoutDraft["amount"] } | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const fingerprint = JSON.stringify({ cart: items.map(item => ({ productId: item.id, sku: item.sku, selectedColor: item.selectedColor, selectedSize: item.selectedSize, quantity: item.quantity || 1 })) });
  useEffect(() => {
    if (!items.length) return;
    const controller = new AbortController(); setQuoteError("");
    fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: fingerprint, signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "The total could not be checked.");
      if (!controller.signal.aborted) setQuote({ fingerprint, amount: result.amount });
    }).catch(error => { if (!controller.signal.aborted) setQuoteError(error.message); });
    return () => controller.abort();
  }, [fingerprint, items.length]);

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Cart</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.07em]">Your selection</h1><p className="mt-2 text-sm">Maximum 10 units per cart. Your total includes applicable taxes and charges.</p>
          </div>
          <Link href="/products" className="rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
            Continue shopping
          </Link>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-[#173B35]/20 bg-white p-10 text-center">
            <p className="text-lg font-semibold">Your cart is empty.</p>
            <p className="mt-2 text-sm text-[#173B35]/70">Add products from the catalogue to place an order.</p>
            <Link href="/products" className="mt-5 inline-flex rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">
              Browse products
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1.5fr_0.5fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <div key={`${item.id}-${item.sku}`} className="grid grid-cols-[64px_minmax(0,1fr)] items-center gap-4 rounded-[24px] border border-[#173B35]/10 bg-white p-4 shadow-[0_12px_30px_rgba(23,59,53,0.05)] sm:flex">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#F7F4ED] sm:h-20 sm:w-20">
                    <ProductImage src={item.imageUrls?.[0]} alt={item.name} fit="contain" width={160} height={160} sizes="80px" className="h-full w-full object-contain p-1" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-lg font-bold text-[#173B35]">{item.name}</p>
                    <p className="break-all text-sm text-[#173B35]/60">SKU: {item.sku}</p>{item.selectedColor || item.selectedSize ? <p className="text-sm">{[item.selectedColor, item.selectedSize].filter(Boolean).join(" / ")}</p> : null}
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 sm:block sm:text-right">
                    <label className="mt-2 block text-xs">Quantity<input aria-label={`Quantity for ${item.name}`} type="number" min="1" max="10" value={item.quantity ?? 1} className="ml-2 w-16 rounded border p-2" onChange={(event) => { const quantity = event.target.valueAsNumber; if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) return; const next = readCart(localStorage).map((entry) => entry.id === item.id ? { ...entry, quantity } : entry); if (next.reduce((sum, entry) => sum + entry.quantity, 0) > 10) { window.alert("Your cart can contain a maximum of 10 units."); return; } writeCart(localStorage, next); setItems(next); }} /></label><button type="button" className="mt-2 text-xs underline" onClick={() => { const next = readCart(localStorage).filter((entry) => entry.id !== item.id); writeCart(localStorage, next); setItems(next); }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>

            <aside className="rounded-[24px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_30px_rgba(23,59,53,0.05)]">
              <CheckoutSummary amount={quote?.fingerprint === fingerprint ? quote.amount : null} />
              {quoteError ? <p role="alert" className="mt-3 text-sm text-red-700">{quoteError}</p> : null}
              <Link href="/checkout" className="mt-5 inline-flex w-full justify-center rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white">
                Confirm quantity & address
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
