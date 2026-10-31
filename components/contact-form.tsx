"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";
export function ContactForm() {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setSent(false); const form = event.currentTarget;
    try {
      const response = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(new FormData(form))) });
      const result = await response.json(); if (!response.ok) throw Error(result.message || "Message could not be sent.");
      setSent(true); setMessage(`${result.message}${result.reference ? ` Your reference: ${result.reference}` : ""}`); form.reset();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Message could not be sent. Please try again."); } finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mt-5"><fieldset disabled={!ready || busy} className="grid gap-4 sm:grid-cols-2"><label className="font-semibold">Full Name<input name="fullName" required minLength={2} maxLength={120} autoComplete="name" className="mt-2 block w-full rounded-xl border border-[#173B35]/20 p-3 font-normal" /></label><label className="font-semibold">Email Address<input name="email" type="email" required maxLength={254} autoComplete="email" className="mt-2 block w-full rounded-xl border border-[#173B35]/20 p-3 font-normal" /></label><label className="font-semibold sm:col-span-2">Order Number (if applicable)<input name="orderNumber" maxLength={100} className="mt-2 block w-full rounded-xl border border-[#173B35]/20 p-3 font-normal" /></label><label className="font-semibold sm:col-span-2">Subject<input name="subject" required minLength={3} maxLength={150} className="mt-2 block w-full rounded-xl border border-[#173B35]/20 p-3 font-normal" /></label><label className="font-semibold sm:col-span-2">Message<textarea name="message" rows={5} required minLength={10} maxLength={3000} className="mt-2 block w-full rounded-xl border border-[#173B35]/20 p-3 font-normal" /></label><div hidden aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div><button type="submit" className="w-fit rounded-xl bg-[#173B35] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send message"}</button></fieldset>{message ? <p role={sent ? "status" : "alert"} className={`mt-5 rounded-xl p-4 ${sent ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{message}</p> : null}</form>;
}
