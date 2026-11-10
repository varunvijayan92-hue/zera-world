"use client";
import { useState, type FormEvent } from "react";

export function CjOrderPolicyForm({ origin, trackedMethods, canEdit }: { origin: string; trackedMethods: string[]; canEdit: boolean }) {
  const [country, setCountry] = useState(origin);
  const [methods, setMethods] = useState(trackedMethods.join("\n"));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/suppliers/cj-order-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: country, trackedMethods: methods.split(/\r?\n/).map(value => value.trim()).filter(Boolean) }) });
      const body = await response.json(); if (!response.ok) throw Error(body.message); setMessage(body.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save shipping settings."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">CJ order shipping settings</h2><p className="my-3 text-sm">Enter only shipping methods CJ has confirmed are tracked to India. If none is confirmed, leave the list empty. Orders that cost more than the sale must be held for review. Saving these settings does not turn on automatic ordering.</p><form onSubmit={save}><fieldset disabled={!canEdit || busy} className="space-y-4"><label className="block text-sm font-semibold">Warehouse country code<input required maxLength={2} pattern="[A-Za-z]{2}" value={country} onChange={event => setCountry(event.target.value.toUpperCase())} placeholder="e.g. CN" className="mt-2 block w-full rounded-xl border p-3" /></label><label className="block text-sm font-semibold">Confirmed tracked shipping methods, one exact CJ name per line<textarea rows={4} value={methods} onChange={event => setMethods(event.target.value)} className="mt-2 block w-full rounded-xl border p-3" /></label><button className="rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">Save shipping settings</button></fieldset></form>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</section>;
}
