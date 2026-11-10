"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";
type Product = { id: string; name: string; sku: string; price: string };
type Variant = { id: string; name: string; sku: string };
export function CjCatalogSearch() {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [products, setProducts] = useState<Product[]>([]); const [selected, setSelected] = useState(""); const [variants, setVariants] = useState<Variant[]>([]);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") || ""); setBusy(true); setMessage(""); setProducts([]); setVariants([]); setSelected("");
    try { const response = await fetch(`/api/admin/suppliers/cj-catalog?${new URLSearchParams({ q })}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setProducts(result.products); if (result.selectedProductId) { setSelected(result.selectedProductId); setVariants(result.variants || []); } if (!result.products.length) setMessage("No matching CJ products found."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not search CJ."); } finally { setBusy(false); }
  }
  async function showVariants(id: string) {
    setBusy(true); setMessage(""); setVariants([]); setSelected(id);
    try { const response = await fetch(`/api/admin/suppliers/cj-catalog?${new URLSearchParams({ productId: id })}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setVariants(result.variants); if (!result.variants.length) setMessage("No variants were returned by CJ for this product."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load variants."); } finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Find CJ products</h2><p className="my-3 text-sm">Search by product name, SKU, CJ product ID or CJ product link to view variant IDs for mapping. Check delivery to India and the final costs with CJ before listing.</p><form onSubmit={search} className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-sm">Product name, SKU, product ID or CJ link<input name="q" required minLength={2} maxLength={2048} className="mt-2 block w-full rounded-xl border p-3" /></label><button disabled={!ready || busy} className="self-end rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">Search CJ</button></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}<div className="mt-4 space-y-3">{products.map(product => <article key={product.id} className="rounded-xl border p-4 text-sm"><p className="font-semibold">{product.name}</p><p className="mt-1 break-all">Product ID: {product.id}</p><p>SKU: {product.sku || "Not provided"}</p>{product.price ? <p>Listed CJ price: {product.price} (confirm currency and shipping with CJ)</p> : null}<button type="button" disabled={busy} onClick={() => void showVariants(product.id)} className="mt-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">View variants</button>{selected === product.id && variants.length ? <ul className="mt-3 space-y-2 border-t pt-3">{variants.map(variant => <li key={variant.id} className="break-all">{variant.name}<br />Variant ID: {variant.id}<br />SKU: {variant.sku || "Not provided"}</li>)}</ul> : null}</article>)}</div></section>;
}
