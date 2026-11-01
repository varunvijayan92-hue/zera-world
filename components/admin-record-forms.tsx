"use client";

import { SupplierRegistrationForm } from "./supplier-registration-form";
import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useClientReady } from "./use-client-ready";

async function send(url: string, body: unknown, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok) throw Error(result.message || "Changes could not be saved.");
  return result;
}
const field = "mt-2 w-full rounded-xl border border-[#173B35]/20 bg-white px-3 py-2.5 text-sm";
const button = "rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50";

function FormBox({ title, children, message }: { title: string; children: ReactNode; message: string }) {
  return <section className="mb-7 rounded-2xl border border-[#173B35]/10 bg-white p-5"><h2 className="mb-5 text-lg font-bold">{title}</h2>{children}{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}</section>;
}

export function SupplierForm({ canManageLogin = false }: { canManageLogin?: boolean }) { return <SupplierRegistrationForm canManageLogin={canManageLogin} />; }

export function StockForm({ stock }: { stock: { id: string; availableQty: number; reservedQty: number; damagedQty: number; safetyStock: number; updatedAt: string } }) {
  const router = useRouter(); const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [form, setForm] = useState(stock);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { const result = await send(`/api/admin/inventory/${stock.id}`, form, "PATCH"); setForm(result.data); setMessage("Stock updated."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Stock could not be updated."); } finally { setBusy(false); }
  }
  return <details className="min-w-56"><summary className="cursor-pointer font-semibold underline">Adjust stock</summary><form onSubmit={submit} className="mt-3"><fieldset disabled={!ready || busy} className="space-y-3">{([['availableQty','Available quantity'],['reservedQty','Reserved quantity'],['damagedQty','Damaged quantity'],['safetyStock','Safety stock']] as const).map(([key,label]) => <label key={key} className="block text-xs">{label}<input type="number" min="0" step="1" required value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: Number(event.target.value) }))} className={field} /></label>)}<button className={button}>{busy ? "Saving..." : "Save stock"}</button></fieldset></form>{message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}</details>;
}

export function ExpenseForm() {
  const router = useRouter(); const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "Shipping", amount: "", description: "", date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) });
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await send("/api/admin/expenses", { category: form.category, amount: Number(form.amount), description: form.description, expenseDate: new Date(`${form.date}T12:00:00+05:30`).toISOString() }); setForm((current) => ({ ...current, amount: "", description: "" })); setMessage("Expense recorded."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Expense could not be recorded."); } finally { setBusy(false); }
  }
  return <FormBox title="Record an expense" message={message}><form onSubmit={submit}><fieldset disabled={!ready || busy} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold">Expense category<input required maxLength={80} value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Amount (INR)<input required type="number" min="0.01" step="0.01" value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Expense date<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Description<input maxLength={500} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className={field} /></label><button className={`${button} w-fit`}>{busy ? "Saving..." : "Record expense"}</button></fieldset></form></FormBox>;
}

export function UserCreateForm() {
  const router = useRouter(); const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const blank = { fullName: "", email: "", password: "", role: "STAFF" }; const [form, setForm] = useState(blank);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await send("/api/admin/users", form); setForm(blank); setMessage("User account created."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "User could not be created."); } finally { setBusy(false); }
  }
  return <FormBox title="Create a staff or supplier account" message={message}><form onSubmit={submit}><fieldset disabled={!ready || busy} className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="text-sm font-semibold">Full name<input required value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Email<input required type="email" value={form.email} autoComplete="off" onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Initial password<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className={field} /></label><label className="text-sm font-semibold">Role<select aria-label="New account role" value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))} className={field}>{['ADMIN','MANAGER','STAFF','SUPPLIER','CUSTOMER'].map((role) => <option key={role}>{role}</option>)}</select></label><button className={`${button} w-fit`}>{busy ? "Creating..." : "Create user"}</button></fieldset></form></FormBox>;
}

export function UserAccessForm({ user, self }: { user: { id: string; role: string; isActive: boolean }; self: boolean }) {
  const router = useRouter(); const ready = useClientReady(); const [role, setRole] = useState(user.role); const [active, setActive] = useState(user.isActive); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try { await send(`/api/admin/users/${user.id}`, { role, isActive: active }, "PATCH"); setMessage("Access updated."); router.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Access could not be updated."); } finally { setBusy(false); }
  }
  if (self) return <p className="text-xs text-[#173B35]/60">Your account · administrator access protected</p>;
  return <form onSubmit={submit}><fieldset disabled={!ready || busy} className="flex min-w-64 flex-wrap items-center gap-3"><select aria-label="Account role" value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border px-2 py-2 text-xs">{['ADMIN','MANAGER','STAFF','SUPPLIER','CUSTOMER'].map((entry) => <option key={entry}>{entry}</option>)}</select><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Active</label><button className="rounded-lg bg-[#173B35] px-3 py-2 text-xs text-white">{busy ? "Saving..." : "Save access"}</button></fieldset>{message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}</form>;
}

export function UserPasswordForm({ user }: { user: { id: string; role: string; isActive: boolean } }) {
  const router = useRouter(); const ready = useClientReady(); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      if (password !== confirm) throw Error("Passwords do not match.");
      await send(`/api/admin/users/${user.id}`, { role: user.role, isActive: user.isActive, password }, "PATCH");
      setPassword(""); setConfirm(""); setMessage("Password updated."); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Password could not be updated."); }
    finally { setBusy(false); }
  }
  return <details className="min-w-56"><summary className="cursor-pointer text-xs font-semibold underline">Edit password</summary><form onSubmit={submit} className="mt-3"><fieldset disabled={!ready || busy} className="space-y-3"><label className="block text-xs">New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={72} autoComplete="new-password" className={field} /></label><label className="block text-xs">Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={12} maxLength={72} autoComplete="new-password" className={field} /></label><button className="rounded-lg bg-[#173B35] px-3 py-2 text-xs text-white">{busy ? "Saving..." : "Save password"}</button></fieldset>{message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}</form></details>;
}
