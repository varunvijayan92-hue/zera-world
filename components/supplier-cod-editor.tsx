"use client";
import { useState } from "react";
export function SupplierCodEditor({ supplierId, current }: { supplierId: string; current: string }) {
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function save() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/suppliers/${encodeURIComponent(supplierId)}/cod`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codHandling: value }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not save COD settings.");
      setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save COD settings."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-48 space-y-2 text-xs"><label>COD collection<select value={value} onChange={event => setValue(event.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="NONE">Not available</option><option value="OWN_COURIER">Our courier collects</option><option value="SUPPLIER_COURIER">Supplier courier collects</option></select></label><button type="button" disabled={busy} onClick={() => void save()} className="rounded-lg bg-[#173B35] px-3 py-2 text-white disabled:opacity-50">{busy ? "Saving..." : "Save COD"}</button><p>Enable only after confirming COD with the courier or supplier. Each product must also allow COD.</p>{message && <p role="status">{message}</p>}</div>;
}
