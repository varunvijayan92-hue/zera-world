"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "./use-client-ready";

export function SupplierPickupEditor({ supplierId, current }: { supplierId: string; current: string | null }) {
  const ready = useClientReady(); const router = useRouter();
  const [locations, setLocations] = useState<{ name: string }[]>([]);
  const [value, setValue] = useState(current || ""); const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function load() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/shipping/pickup-locations", { cache: "no-store" });
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      setLocations(result.locations); setLoaded(true);
      if (!result.locations.length) setMessage("No active pickup locations. Add the supplier address in Shiprocket, then reload.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Locations could not be loaded."); }
    finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/pickup-location`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pickupLocation: value || null }) });
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      setMessage(result.message); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Mapping could not be saved."); }
    finally { setBusy(false); }
  }
  return <div className="min-w-56 max-w-sm text-xs"><p className="break-words">{current || "Not linked"}</p><details className="mt-2"><summary className="cursor-pointer font-semibold underline">Edit pickup mapping</summary><button type="button" disabled={!ready || busy} onClick={load} className="my-3 rounded-lg border px-3 py-2 disabled:opacity-50">Reload Shiprocket locations</button><form onSubmit={save}><label className="block">Shiprocket pickup location<select aria-label="Shiprocket pickup location" disabled={!ready || busy} value={value} onChange={event => setValue(event.target.value)} className="mt-2 block w-full rounded-lg border p-2"><option value="">Not linked</option>{value && !locations.some(entry => entry.name === value) ? <option value={value}>{value}{loaded ? " (not in latest list)" : ""}</option> : null}{locations.map(entry => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></label><button disabled={!ready || busy || (!loaded && !!value && value !== current)} className="mt-3 rounded-lg bg-[#173B35] px-3 py-2 text-white disabled:opacity-50">Save pickup mapping</button></form><a href="https://app.shiprocket.in/seller/settings/company-setup/pickup-addresses" target="_blank" rel="noopener noreferrer" className="mt-3 block underline">Manage pickup addresses in Shiprocket</a></details>{message ? <p role="status" className="mt-2">{message}</p> : null}</div>;
}
