"use client";
import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { voucherCategories } from "@/lib/expense-vouchers";

export function ExpenseVoucherForm() {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [id, setId] = useState("");
  const submission = useRef("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = event.currentTarget, fields = new FormData(form);
    setBusy(true); setMessage(""); setId("");
    submission.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/admin/accounts/vouchers", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(fields), submissionId: submission.current, amount: Number(fields.get("amount")), confirmedNotRecorded: fields.get("confirmedNotRecorded") === "on" }) });
      const data = await response.json(); if (!response.ok) throw Error(data.message || "Could not save voucher.");
      setMessage(`Voucher ${data.number} saved.`); setId(data.id); submission.current = ""; form.reset(); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save voucher."); } finally { setBusy(false); }
  }
  const field = "mt-2 block w-full rounded-xl border bg-white p-3";
  return <details className="mb-6 rounded-2xl border bg-white p-5 print:hidden"><summary className="cursor-pointer font-bold">Add expense / payment voucher</summary><p className="my-4 text-sm">Record courier payments, packing materials, stationery and other purchases. The total is included once in Accounts and Profit &amp; Loss. Do not enter courier costs already saved against a shipment. This records a payment; it does not transfer funds.</p><form onSubmit={submit}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2"><label>Category<select name="category" className={field}>{voucherCategories.map(value => <option key={value}>{value}</option>)}</select></label><label>Payee / business<input name="payee" required maxLength={120} className={field} /></label><label>Total paid (INR, including tax)<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required className={field} /></label><label>Expense date<input name="date" type="date" required className={field} /></label><label>Bill / invoice reference (optional)<input name="reference" maxLength={100} className={field} /></label><label>Payment method<select name="paymentMethod" className={field}>{["CASH", "UPI", "BANK", "CARD"].map(value => <option key={value}>{value}</option>)}</select></label><label>Payment reference (optional)<input name="paymentReference" maxLength={120} className={field} /></label><label>Description<input name="description" required maxLength={500} className={field} /></label><label className="sm:col-span-2"><input name="confirmedNotRecorded" type="checkbox" required className="mr-2" />This expense has not already been recorded as an expense or shipment cost.</label><button className="w-fit rounded-xl bg-[#173B35] px-5 py-3 text-white">{busy ? "Saving..." : "Save expense voucher"}</button></fieldset></form>{message ? <p role="status" className="mt-4 break-all">{message}</p> : null}{id ? <Link href={`/admin/accounts/vouchers/${id}`} className="mt-3 block underline">View / print voucher</Link> : null}</details>;
}
