"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function CartPage() {
  const [items, setItems] = useState<Array<{ id: string; name: string; sku: string; sellingPrice?: number | string | null; quantity?: number; imageUrls?: string[] | null }>>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("zeraworld-cart") || "[]");
    setItems(stored);
  }, []);

  const total = items.reduce((sum, item) => sum + Number(item.sellingPrice ?? 0) * Number(item.quantity ?? 1), 0);

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Cart</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.07em]">Your selection</h1>
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
                <div key={`${item.id}-${item.sku}`} className="flex items-center gap-4 rounded-[24px] border border-[#173B35]/10 bg-white p-4 shadow-[0_12px_30px_rgba(23,59,53,0.05)]">
                  <div className="h-20 w-20 overflow-hidden rounded-2xl bg-[#F7F4ED]">
                    {item.imageUrls?.[0] ? <img src={item.imageUrls[0]} alt={item.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl">✦</div>}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-[#173B35]">{item.name}</p>
                    <p className="text-sm text-[#173B35]/60">SKU: {item.sku}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-[#173B35]">₹{Number(item.sellingPrice ?? 0).toLocaleString("en-IN")}</p>
                    <p className="text-xs text-[#173B35]/60">Qty {item.quantity ?? 1}</p>
                  </div>
                </div>
              ))}
            </div>

            <aside className="rounded-[24px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_30px_rgba(23,59,53,0.05)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Summary</p>
              <div className="mt-4 flex items-center justify-between text-sm text-[#173B35]/70">
                <span>Subtotal</span>
                <span>₹{total.toLocaleString("en-IN")}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm text-[#173B35]/70">
                <span>Shipping</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="mt-4 border-t border-[#173B35]/10 pt-4">
                <div className="flex items-center justify-between text-lg font-black text-[#173B35]">
                  <span>Total</span>
                  <span>₹{total.toLocaleString("en-IN")}</span>
                </div>
              </div>
              <Link href="/checkout" className="mt-5 inline-flex w-full justify-center rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white">
                Proceed to checkout
              </Link>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
