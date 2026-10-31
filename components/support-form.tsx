"use client";
import { useState } from "react";
import { useClientReady } from "./use-client-ready";
import { useRouter } from "next/navigation";
export function SupportForm() {
  const ready = useClientReady();
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
  return <form className="space-y-3 rounded-2xl border bg-white p-5" onSubmit={async (event) => { event.preventDefault(); setBusy(true); const form = event.currentTarget; const data = new FormData(form); try { const response = await fetch("/api/account/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); form.reset(); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Request failed."); } finally { setBusy(false); } }}><fieldset disabled={!ready || busy} className="space-y-3"><label className="block text-sm">Subject<input name="subject" required minLength={3} maxLength={100} className="mt-2 block w-full rounded-xl border p-3" /></label><label className="block text-sm">Question<textarea name="message" required minLength={10} maxLength={3000} className="mt-2 block w-full rounded-xl border p-3" /></label><button disabled={busy} className="rounded-xl bg-[#173B35] px-5 py-3 text-white">Send to store support</button></fieldset>{message ? <p role="status">{message}</p> : null}</form>;
}
