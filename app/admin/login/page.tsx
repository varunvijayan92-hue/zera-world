"use client";

import { useState, type FormEvent } from "react";
import { useClientReady } from "@/components/use-client-ready";

export default function StoreAdminLogin() {
  const ready = useClientReady();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ loginId, password }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Sign-in failed.");
      if (!["ADMIN", "MANAGER"].includes(result.user?.role)) throw Error("This account does not have store admin access.");
      window.location.href = "/admin/dashboard";
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-5 py-16"><form onSubmit={submit} className="rounded-3xl border border-[#173B35]/10 bg-white p-8 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-[#173B35]/60">Store content</p><h1 className="mt-2 text-3xl font-black">Admin sign in</h1><p className="mt-3 text-sm text-[#173B35]/70">Manage product details, Cloudinary photos and the website menu.</p><label className="mt-6 block text-sm font-semibold">Email or login ID<input disabled={!ready || busy} autoComplete="username" required value={loginId} onChange={(event) => setLoginId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="mt-4 block text-sm font-semibold">Password<input disabled={!ready || busy} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label>{message ? <p role="alert" className="mt-4 text-sm text-red-700">{message}</p> : null}<button disabled={!ready || busy} className="mt-6 w-full rounded-xl bg-[#173B35] px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Signing in..." : "Sign in"}</button></form></main>;
}
