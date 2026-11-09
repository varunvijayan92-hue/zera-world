"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";

export function CjIntegrationForm({ saved, canEdit }: { saved: boolean; canEdit: boolean }) {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [hasKey, setHasKey] = useState(saved);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const apiKey = String(new FormData(form).get("apiKey") || "");
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: "CJ_DROPSHIPPING", credentials: { apiKey } }) }); const result = await response.json(); if (!response.ok) throw Error(result.message); form.reset(); setHasKey(true); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save the key."); } finally { setBusy(false); }
  }
  async function check() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/integrations/cj", { method: "POST" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Connection check failed."); } finally { setBusy(false); }
  }
  return <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">CJdropshipping</h2><p className="my-3 text-sm">{hasKey ? "An API key is saved. Enter a replacement to change it." : "No CJ API key saved."}</p><p className="mb-4 text-sm">Save your CJ API key securely, then check authentication. Product imports, order fulfilment and tracking are not connected yet.</p><form onSubmit={save}><fieldset disabled={!ready || busy || !canEdit} className="space-y-3"><label className="block text-sm">CJ API key<input name="apiKey" type="password" autoComplete="off" required maxLength={200} className="mt-2 block w-full rounded-xl border p-3" /></label><button className="rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">Save CJ API key</button></fieldset></form><button type="button" disabled={!ready || busy || !canEdit || !hasKey} onClick={check} className="mt-4 rounded-xl border px-4 py-3 text-sm disabled:opacity-50">Check CJ connection</button>{!canEdit ? <p className="mt-3 text-sm">Only administrators can change or check credentials.</p> : null}{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}<p className="mt-4 text-xs opacity-60">The key is encrypted on the server and is never displayed after saving.</p></section>;
}
