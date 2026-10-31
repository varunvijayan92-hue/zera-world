"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useClientReady } from "./use-client-ready";
export function PortalLogin({ supplier = false }: { supplier?: boolean }) {
  const ready = useClientReady(); const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget); const email = String(form.get("email")); const password = String(form.get("password"));
    try {
      const response = await fetch(register ? "/api/auth/register" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(register ? { email, password, fullName: form.get("fullName") } : { loginId: email, password, portal: supplier ? "SUPPLIER" : "CUSTOMER" }) });
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      if (register) { setRegister(false); setMessage(result.message); } else window.location.assign(supplier ? "/suppliers/dashboard" : "/account");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign in failed."); } finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] p-5 text-[#173B35]"><div className="w-full max-w-md rounded-3xl border bg-white p-8"><Link href="/" className="font-black">Zera&apos;s World</Link><h1 className="my-5 text-3xl font-bold">{supplier ? "Supplier login" : register ? "Create customer account" : "Customer login"}</h1><form onSubmit={submit}><fieldset disabled={!ready || busy} className="space-y-4">{register ? <label className="block text-sm">Full name<input name="fullName" required maxLength={100} autoComplete="name" className="mt-2 w-full rounded-xl border p-3" /></label> : null}<label className="block text-sm">{supplier ? "Login ID or email" : "Email"}<input name="email" type={supplier ? "text" : "email"} required autoComplete={supplier ? "username" : "email"} className="mt-2 w-full rounded-xl border p-3" /></label><label className="block text-sm">Password<input name="password" type="password" required minLength={register ? 12 : 6} autoComplete={register ? "new-password" : "current-password"} className="mt-2 w-full rounded-xl border p-3" /></label><button className="w-full rounded-xl bg-[#173B35] p-3 font-bold text-white">{busy ? "Please wait…" : register ? "Create account" : "Sign in"}</button></fieldset></form>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}{!supplier ? <button type="button" onClick={() => { setRegister(!register); setMessage(""); }} className="mt-5 text-sm underline">{register ? "Already have an account? Sign in" : "Create an account"}</button> : <p className="mt-5 text-sm">Your store administrator provides supplier access after approval.</p>}</div></main>;
}
