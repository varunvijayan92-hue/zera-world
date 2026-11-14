"use client";
import { useState, type FormEvent } from "react";

export function AppPortalLogin() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ portal: "APP", loginId: form.get("loginId"), password: form.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Sign-in failed.");
      if (result.user?.role === "SUPPLIER") window.location.assign("/suppliers/dashboard");
      else if (["ADMIN", "MANAGER"].includes(result.user?.role)) window.location.assign("/admin/dashboard");
      else throw new Error("This account does not have portal access.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="mx-auto w-full max-w-md rounded-3xl border bg-white p-8 shadow-sm"><h1 className="text-3xl font-bold">Admin &amp; supplier sign in</h1><p className="mt-3 text-sm">Sign in with your existing portal account.</p><label className="mt-6 block text-sm font-semibold">Email or login ID<input name="loginId" required autoComplete="username" disabled={busy} className="mt-2 w-full rounded-xl border p-3" /></label><label className="mt-4 block text-sm font-semibold">Password<input name="password" type="password" required autoComplete="current-password" disabled={busy} className="mt-2 w-full rounded-xl border p-3" /></label>{message ? <p role="alert" className="mt-4 text-sm text-red-700">{message}</p> : null}<button disabled={busy} className="mt-6 w-full rounded-xl bg-[#173B35] p-3 font-semibold text-white disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button></form>;
}
