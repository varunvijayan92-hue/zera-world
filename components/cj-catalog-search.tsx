"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClientReady } from "./use-client-ready";
type Product = { id: string; name: string; sku: string; price: string };
type Variant = { id: string; name: string; sku: string };
export function CjCatalogSearch({ storeProducts, suppliers }: { storeProducts: { id: string; name: string; sku: string }[]; suppliers: { id: string; companyName: string }[] }) {
  const [storeProductId, setStoreProductId] = useState("");
  const [supplierId, setSupplierId] = useState(suppliers.length === 1 ? suppliers[0].id : "");
  const [draftId, setDraftId] = useState("");
  const router = useRouter();
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [products, setProducts] = useState<Product[]>([]); const [selected, setSelected] = useState(""); const [variants, setVariants] = useState<Variant[]>([]);
  async function syncProduct(cjProductId: string, productId = storeProductId) {
    if (!productId) { setMessage("Choose a store product to sync variants."); return; }
    const response = await fetch("/api/admin/suppliers/cj-variant-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, cjProductId }) });
    const result = await response.json();
    if (!response.ok) throw Error(result.message || "Variant sync failed.");
    setMessage(result.message); router.refresh();
  }
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const q = String(new FormData(event.currentTarget).get("q") || ""); setBusy(true); setMessage(""); setProducts([]); setVariants([]); setSelected("");
    try { const response = await fetch(`/api/admin/suppliers/cj-catalog?${new URLSearchParams({ q })}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setProducts(result.products); if (result.selectedProductId) { setSelected(result.selectedProductId); setVariants(result.variants || []); if (storeProductId) await syncProduct(result.selectedProductId, storeProductId); } if (!result.products.length) setMessage("No matching CJ products found."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not search CJ."); } finally { setBusy(false); }
  }
  async function showVariants(id: string) {
    setBusy(true); setMessage(""); setVariants([]); setSelected(id);
    try { const response = await fetch(`/api/admin/suppliers/cj-catalog?${new URLSearchParams({ productId: id })}`, { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setVariants(result.variants); if (!result.variants.length) setMessage("No variants were returned by CJ for this product."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load variants."); } finally { setBusy(false); }
  }
  async function createDraft(cjProductId: string) {
    setBusy(true); setMessage(""); setDraftId("");
    try {
      const response = await fetch("/api/admin/suppliers/cj-draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cjProductId, supplierId }) });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || "Could not create draft.");
      setDraftId(data.productId); setMessage(data.message); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create draft."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Find CJ products</h2><p className="my-3 text-sm">Search by product name, SKU, CJ product ID or CJ product link to view variant IDs for mapping. Check delivery to India and the final costs with CJ before listing.</p><label className="my-3 block text-sm">Store product to update (optional)<select value={storeProductId} onChange={event => setStoreProductId(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"><option value="">Search only - do not update</option>{storeProducts.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label><p className="mb-3 text-xs">Selecting a store product and searching by CJ link or ID updates its variant records. Stock, prices, photos and storefront colour/size options are not synchronized.</p><label className="mb-3 block text-sm">CJ supplier for new drafts<select value={supplierId} onChange={event => setSupplierId(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"><option value="">Select an active CJ supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</select></label><form onSubmit={search} className="flex flex-wrap gap-3"><label className="min-w-0 flex-1 text-sm">Product name, SKU, product ID or CJ link<input name="q" required minLength={2} maxLength={2048} className="mt-2 block w-full rounded-xl border p-3" /></label><button disabled={!ready || busy} className="self-end rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">Search CJ</button></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}{draftId ? <Link href={`/admin/products?product=${encodeURIComponent(draftId)}`} className="mt-3 inline-block font-semibold underline">Open draft product</Link> : null}<div className="mt-4 space-y-3">{products.map(product => <article key={product.id} className="rounded-xl border p-4 text-sm"><p className="font-semibold">{product.name}</p><p className="mt-1 break-all">Product ID: {product.id}</p><p>SKU: {product.sku || "Not provided"}</p>{product.price ? <p>Listed CJ price: {product.price} (confirm currency and shipping with CJ)</p> : null}<button type="button" disabled={busy} onClick={() => void showVariants(product.id)} className="mt-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">View variants</button><button type="button" disabled={busy || !supplierId} onClick={() => void createDraft(product.id)} className="ml-2 mt-2 rounded-lg bg-[#173B35] px-3 py-2 font-semibold text-white disabled:opacity-50">Add as draft</button>{storeProductId ? <button type="button" disabled={busy} onClick={() => { setBusy(true); setMessage(""); void syncProduct(product.id).catch(error => setMessage(error instanceof Error ? error.message : "Variant sync failed.")).finally(() => setBusy(false)); }} className="ml-2 mt-2 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50">Sync variants to store product</button> : null}{selected === product.id && variants.length ? <ul className="mt-3 space-y-2 border-t pt-3">{variants.map(variant => <li key={variant.id} className="break-all">{variant.name}<br />Variant ID: {variant.id}<br />SKU: {variant.sku || "Not provided"}</li>)}</ul> : null}</article>)}</div></section>;
}
