"use client";
import { useState, type FormEvent } from "react";

export function ProductManualStock({ productId, available }: { productId: string; available: number }) {
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(productId)}/stock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ quantity: Number(quantity) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save stock.");
      setMessage(`Saved ${data.total} units. ${data.reserved} reserved; ${data.total - data.reserved} available to sell.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save stock."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><h2 className="text-xl font-bold">Manual stock quantity</h2><p className="mt-2 text-sm">Available when this page loaded: {available}. Enter the total units on hand, including any reserved units.</p><p className="mt-2 text-xs text-[#173B35]/70">This sets stock for the whole product, not individual colours or sizes. CJ stock and order submission are not automatic.</p><form onSubmit={save} className="mt-4 flex flex-wrap items-end gap-3"><label className="text-sm font-semibold">Total stock units<input type="number" min="0" max="1000000" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} className="mt-2 block rounded-xl border px-3 py-3" /></label><button disabled={busy} className="rounded-xl bg-[#173B35] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : "Save quantity"}</button></form>{message && <p role="status" className="mt-3 text-sm">{message}</p>}</section>;
}
