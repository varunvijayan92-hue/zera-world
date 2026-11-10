"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

type Variant = { id: string; variantName: string; sku: string };
type Mapping = { id: string; variantId: string | null; externalProductId: string | null; supplierVariantId: string | null; supplierSku: string | null; supplierVariantKey: string | null; packagingSku: string | null; supplierStockQty: number | null; lastStockCheckAt: string | null; mappingStatus: string | null };

function PackagingSku({ productId, mapping }: { productId: string; mapping: Mapping }) {
  const [value, setValue] = useState(mapping.packagingSku || "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/suppliers/cj-variant-sync/${encodeURIComponent(productId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mappingId: mapping.id, packagingSku: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save packaging SKU.");
      setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save packaging SKU."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-44"><input aria-label={`Packaging SKU for ${mapping.supplierSku || "variant"}`} maxLength={200} value={value} onChange={event => setValue(event.target.value)} className="w-full rounded-lg border p-2" /><button type="button" onClick={() => void save()} disabled={busy} className="mt-1 text-xs font-semibold underline disabled:opacity-50">{busy ? "Saving..." : "Save packaging SKU"}</button>{message && <p role="status" className="mt-1 text-xs">{message}</p>}</div>;
}

export function ProductCjVariants({ productId }: { productId: string }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [cjId, setCjId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/suppliers/cj-variant-sync/${encodeURIComponent(productId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load variants.");
    setVariants(data.variants); setMappings(data.mappings);
    const ids = Array.from(new Set<string>(data.mappings.map((mapping: Mapping) => mapping.externalProductId).filter((id: string | null): id is string => !!id)));
    if (ids.length === 1) setCjId(ids[0]);
  }, [productId]);
  useEffect(() => { void load().catch(error => setMessage(error.message)); }, [load]);
  async function sync() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/cj-variant-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, cjProductId: cjId.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Sync failed.");
      const stock = await fetch("/api/admin/suppliers/cj-stock-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, cjProductId: cjId.trim() }) });
      const stockData = await stock.json();
      await load(); setMessage(`${data.message} ${stock.ok ? stockData.message : "CJ stock could not be refreshed; try again."}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sync failed."); }
    finally { setBusy(false); }
  }
  async function refreshStock() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/cj-stock-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, cjProductId: cjId.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not refresh CJ stock.");
      await load(); setMessage(data.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not refresh CJ stock."); }
    finally { setBusy(false); }
  }
  async function addManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/cj-manual-variant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, cjProductId: cjId.trim(), cjVariantId: values.get("cjVariantId"), cjSku: values.get("cjSku"), variantName: values.get("variantName"), optionKey: values.get("optionKey") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not save the mapping.");
      form.reset(); await load(); setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the mapping."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><h2 className="text-xl font-bold">CJ product variants</h2><p className="mt-2 text-sm text-[#173B35]/70">Assign and save an active CJ supplier to this product first. Enter its CJ product ID and sync to update the variant IDs and SKUs stored in Zera’s World.</p><div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm font-semibold">CJ product ID<input value={cjId} onChange={event => setCjId(event.target.value)} placeholder="e.g. 2504020615571615100" className="mt-2 block w-full rounded-xl border px-3 py-3" /></label><button type="button" disabled={busy || !cjId.trim()} onClick={() => void sync()} className="rounded-xl bg-[#173B35] px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Syncing..." : "Sync CJ variants"}</button><button type="button" disabled={busy || !cjId.trim()} onClick={() => void refreshStock()} className="rounded-xl border border-[#173B35] px-5 py-3 font-semibold disabled:opacity-50">Refresh CJ stock</button></div>{message && <p role="status" className="mt-3 text-sm">{message}</p>}<p className="mt-3 text-xs text-[#173B35]/70">This updates local mappings only. It does not connect the product in CJ’s Connected list or submit orders, and does not update stock, prices or customer options.</p><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead><tr className="border-b"><th className="p-2">Variant</th><th className="p-2">CJ colour / size</th><th className="p-2">Store SKU</th><th className="p-2">CJ variant ID</th><th className="p-2">CJ SKU</th><th className="p-2">CJ stock</th><th className="p-2">Packaging SKU</th><th className="p-2">Mapping</th></tr></thead><tbody>{variants.map(variant => { const matches = mappings.filter(mapping => mapping.variantId === variant.id); return <tr key={variant.id} className="border-b align-top"><td className="p-2">{variant.variantName}</td><td className="p-2">{matches.map(m => m.supplierVariantKey || "Not supplied").join(", ") || "Not mapped"}</td><td className="p-2 break-all">{variant.sku}</td><td className="p-2 break-all">{matches.map(m => m.supplierVariantId || "—").join(", ") || "—"}</td><td className="p-2 break-all">{matches.map(m => m.supplierSku || "—").join(", ") || "—"}</td><td className="p-2">{matches.map(m => m.supplierStockQty === null ? "Unknown" : `${m.supplierStockQty} (${m.lastStockCheckAt ? new Date(m.lastStockCheckAt).toLocaleString() : "time unknown"})`).join(", ") || "Unknown"}</td><td className="p-2">{matches.map(m => <PackagingSku key={m.id} productId={productId} mapping={m} />)}</td><td className="p-2">{matches.map(m => m.mappingStatus || "Unknown").join(", ") || "Not mapped"}</td></tr>; })}</tbody></table>{variants.length === 0 && <p className="p-2 text-sm">No variants saved for this product yet.</p>}</div><details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer font-semibold">Add a CJ variant manually</summary><p className="mt-2 text-sm">Enter the CJ product ID above, then add the variant. Manual entries remain pending until you select Sync CJ variants.</p><form onSubmit={addManual} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Variant name<input name="variantName" required maxLength={255} placeholder="e.g. Olive 66 cm" className="mt-1 block w-full rounded-xl border p-3" /></label><label className="text-sm">CJ colour / size key (optional)<input name="optionKey" maxLength={255} placeholder="e.g. Olive-66cm" className="mt-1 block w-full rounded-xl border p-3" /></label><label className="text-sm">CJ variant ID<input name="cjVariantId" required maxLength={100} pattern="[a-zA-Z0-9-]+" className="mt-1 block w-full rounded-xl border p-3" /></label><label className="text-sm">CJ SKU (also used as store variant SKU)<input name="cjSku" required maxLength={100} className="mt-1 block w-full rounded-xl border p-3" /></label><button disabled={busy || !cjId.trim()} className="w-fit rounded-xl bg-[#173B35] px-4 py-3 font-semibold text-white disabled:opacity-50">Save pending mapping</button></form></details></section>;
}
