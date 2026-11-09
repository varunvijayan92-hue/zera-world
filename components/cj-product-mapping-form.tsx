"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "./use-client-ready";

export function CjProductMappingForm({ products, suppliers }: { products: { id: string; name: string; sku: string; supplierId: string | null }[]; suppliers: { id: string; companyName: string }[] }) {
  const ready = useClientReady(); const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/suppliers/cj-mappings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); form.reset(); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Mapping could not be saved."); } finally { setBusy(false); }
  }
  const field = "mt-2 block w-full rounded-xl border bg-white p-3";
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Map a CJ product</h2><p className="my-3 text-sm">Assign your CJdropshipping supplier to the product in Products first. Save the CJ product and variant IDs here. This does not import products, check stock or send orders.</p><form onSubmit={save}><fieldset disabled={!ready || busy} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Product<select name="productId" required defaultValue="" className={field}><option value="" disabled>Select a product</option>{products.map(product => <option key={product.id} value={product.id}>{product.name} ({product.sku})</option>)}</select></label><label className="text-sm">CJ supplier<select name="supplierId" required defaultValue="" className={field}><option value="" disabled>Select a supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</select></label><label className="text-sm">CJ product ID<input name="externalProductId" required maxLength={100} className={field} /></label><label className="text-sm">CJ variant ID<input name="supplierVariantId" required maxLength={100} className={field} /></label><label className="text-sm">CJ SKU (optional)<input name="supplierSku" maxLength={100} className={field} /></label><div className="flex items-end"><button className="rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">{busy ? "Saving..." : "Save product mapping"}</button></div></fieldset></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}</section>;
}
