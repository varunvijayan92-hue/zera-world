"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "./use-client-ready";
export function SupplierPortalForm({ action, fields, defaults = {}, hidden = {}, url = "/api/supplier/actions" }: { url?: string; action: string; fields: [string, string, string][]; defaults?: Record<string, string>; hidden?: Record<string, string> }) {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...data, ...hidden }) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="my-4 rounded-2xl border bg-white p-4"><fieldset disabled={!ready || busy} className="grid gap-3 sm:grid-cols-2">{fields.map(([key, label, type]) => <label key={key} className="text-sm">{label}{type === "courier" ? <select name={key} aria-label={label} defaultValue={defaults[key] || "Shiprocket"} className="mt-2 block w-full rounded-lg border p-2"><option value="Shiprocket">Shiprocket</option><option value="Delhivery">Delhivery</option></select> : <input name={key} type={type} required defaultValue={defaults[key]} min={type === "number" ? "0" : undefined} step={type === "number" ? "0.01" : undefined} maxLength={3000} className="mt-2 block w-full rounded-lg border p-2" />}</label>)}<button className="w-fit rounded-xl bg-[#173B35] px-4 py-2 text-sm font-semibold text-white">{busy ? "Saving…" : "Save"}</button></fieldset>{message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}</form>;
}
