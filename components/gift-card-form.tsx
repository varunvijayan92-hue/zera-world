"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "./use-client-ready";

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return `ZWGC-${Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
export function GiftCardForm() {
  const ready = useClientReady(), router = useRouter();
  const [code, setCode] = useState(""); const [amount, setAmount] = useState("500");
  const [email, setEmail] = useState(""); const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [issued, setIssued] = useState<{ code: string; balance: string; customer: { fullName: string } } | null>(null);
  useEffect(() => setCode(newCode()), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setMessage(""); setIssued(null);
    try {
      const response = await fetch("/api/admin/gift-cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, customerEmail: email, amount: Number(amount), expiresOn }) });
      const result = await response.json(); if (!response.ok) throw Error(result.message || "Gift card could not be created.");
      setIssued(result.data); setMessage(result.message); setCode(newCode());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to confirm creation. Check the issued cards before retrying."); }
    finally { setBusy(false); router.refresh(); }
  }
  const field = "mt-2 block w-full rounded-xl border bg-white p-3";
  return <section className="mb-7 rounded-2xl border bg-white p-5 md:p-7"><h2 className="mb-4 text-xl font-bold">Create gift card</h2><form onSubmit={submit}><fieldset disabled={!ready || busy} className="grid gap-4 sm:grid-cols-2">
    <label className="text-sm font-semibold">Customer email<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="off" maxLength={254} className={field} /><span className="mt-1 block text-xs font-normal">Use an active customer&apos;s registered email.</span></label>
    <label className="text-sm font-semibold">Gift card amount (INR)<input type="number" required min="0.01" max="100000" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} className={field} /></label>
    <label className="text-sm font-semibold">Gift card code<input required minLength={8} maxLength={40} pattern="[A-Za-z0-9][A-Za-z0-9-]{7,39}" value={code} onChange={event => setCode(event.target.value.toUpperCase())} autoComplete="off" spellCheck={false} className={field} /><button type="button" onClick={() => setCode(newCode())} className="mt-2 text-xs underline">Generate another code</button></label>
    <label className="text-sm font-semibold">Expiry date (optional)<input type="date" value={expiresOn} onChange={event => setExpiresOn(event.target.value)} className={field} /><span className="mt-1 block text-xs font-normal">Valid through the selected date in India time. Leave blank for no expiry.</span></label>
    <button className="w-fit rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">{busy ? "Creating..." : "Create gift card"}</button>
  </fieldset></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}{issued ? <div className="mt-5 rounded-2xl bg-[#173B35] p-6 text-white"><p className="text-xs uppercase tracking-widest">Zera&apos;s World · Gift card</p><p className="mt-3 text-3xl font-black">₹{Number(issued.balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p><p className="mt-2">For {issued.customer.fullName}</p><p className="mt-4 break-all font-mono">{issued.code}</p></div> : null}</section>;
}
