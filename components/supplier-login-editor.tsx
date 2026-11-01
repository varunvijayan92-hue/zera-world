"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { generateSupplierCredentials } from "@/lib/supplier-credentials";
import { useClientReady } from "./use-client-ready";

export function SupplierCredentialReceipt({ loginId, password }: { loginId: string; password: string }) {
  const [show, setShow] = useState(false); const [message, setMessage] = useState("");
  return <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm"><p className="font-bold">Supplier login ready</p><p className="mt-2">Portal: /suppliers/login</p><p className="mt-2 break-all">Login ID: <strong>{loginId}</strong></p><label className="mt-3 block">Initial / reset password<input readOnly type={show ? "text" : "password"} value={password} autoComplete="off" className="mt-2 w-full rounded-lg border bg-white p-2" /></label><button type="button" className="mt-3 mr-5 text-xs underline" onClick={() => setShow(!show)}>{show ? "Hide password" : "Show password"}</button><button type="button" className="mt-3 text-xs underline" onClick={async () => { try { await navigator.clipboard.writeText(`Portal: ${window.location.origin}/suppliers/login\nLogin ID: ${loginId}\nPassword: ${password}`); setMessage("Login details copied. Share them privately with the supplier."); } catch { setMessage("Copy is unavailable. Use Show password and copy the details manually."); } }}>Copy login details</button><p className="mt-3 text-xs">This password is shown only during this operation. It cannot be retrieved later; admins can reset it.</p>{message ? <p role="status" className="mt-2 text-xs">{message}</p> : null}</div>;
}

export function SupplierLoginEditor({ supplierId, account }: { supplierId: string; account: { id: string; loginId: string | null; email: string; isActive: boolean } }) {
  const ready = useClientReady(); const router = useRouter(); const [loginId, setLoginId] = useState(account.loginId || ""); const [password, setPassword] = useState(""); const [active, setActive] = useState(account.isActive); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [receipt, setReceipt] = useState<{ loginId: string; password: string } | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!window.confirm("Save this supplier's login changes? Existing sessions will be signed out.")) return;
    setBusy(true); setMessage(""); setReceipt(null);
    try {
      const response = await fetch(`/api/admin/suppliers/${supplierId}/credentials`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: account.id, loginId, password, isActive: active }) });
      const result = await response.json(); if (!response.ok) throw Error(result.message || "Login could not be updated.");
      if (password) setReceipt({ loginId: result.data.loginId || result.data.email, password });
      setPassword(""); setMessage(result.message); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed."); } finally { setBusy(false); }
  }
  return <details className="min-w-64"><summary className="cursor-pointer text-sm font-semibold underline">{account.loginId || account.email} · Edit login</summary><form onSubmit={save} className="mt-3"><fieldset disabled={!ready || busy} className="space-y-3"><label className="block text-xs">Login ID<input aria-label="Supplier login ID" value={loginId} onChange={(event) => setLoginId(event.target.value)} minLength={3} maxLength={40} pattern="[a-zA-Z0-9][a-zA-Z0-9._-]*" autoComplete="off" className="mt-2 block w-full rounded-lg border p-2" /><span className="mt-1 block opacity-60">Blank keeps the existing ID. Email sign-in remains available.</span></label><label className="block text-xs">New password<input aria-label="New supplier password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={72} autoComplete="new-password" className="mt-2 block w-full rounded-lg border p-2" /><span className="mt-1 block opacity-60">Leave blank to keep the current password.</span></label><button type="button" className="text-xs underline" onClick={() => setPassword(generateSupplierCredentials().password)}>Generate new password</button><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />Login enabled</label><button className="rounded-lg bg-[#173B35] px-4 py-2 text-xs font-semibold text-white">{busy ? "Saving…" : "Save login changes"}</button></fieldset></form>{message ? <p role="status" className="mt-3 text-xs">{message}</p> : null}{receipt ? <SupplierCredentialReceipt {...receipt} /> : null}</details>;
}
