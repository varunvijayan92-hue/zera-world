"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";
type Option = { name: string; usd: number; estimate: string };
export function CjShippingQuote() {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [options, setOptions] = useState<Option[]>([]);
  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); setMessage(""); setOptions([]);
    try { const response = await fetch("/api/admin/suppliers/cj-freight", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setOptions(result.options); if (!result.options.length) setMessage("CJ returned no shipping options for this variant, origin and PIN code."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not check delivery."); } finally { setBusy(false); }
  }
  const field = "mt-2 block w-full rounded-xl border p-3";
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">Check CJ shipping to India</h2><p className="my-3 text-sm">Enter the variant ID and its actual warehouse country code from CJ. Quotes are for one unit and may change; confirm taxes and customs separately.</p><form onSubmit={check}><fieldset disabled={!ready || busy} className="grid gap-4 sm:grid-cols-2"><label className="text-sm">CJ variant ID<input name="variantId" required maxLength={100} className={field} /></label><label className="text-sm">Warehouse country code<input name="origin" required pattern="[A-Z]{2}" maxLength={2} placeholder="e.g. CN" className={field} /></label><label className="text-sm">Indian PIN code<input name="pincode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} className={field} /></label><div className="flex items-end"><button className="rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">{busy ? "Checking..." : "Check shipping"}</button></div></fieldset></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}{options.length ? <ul className="mt-4 space-y-2">{options.map((option, index) => <li key={`${option.name}-${index}`} className="rounded-xl border p-3 text-sm"><strong>{option.name}</strong> — USD {option.usd.toFixed(2)}; {option.estimate === "Not provided" ? "delivery estimate not provided" : `estimated ${option.estimate} days`}</li>)}</ul> : null}</section>;
}
