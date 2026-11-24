"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { getPostLoginRedirectPath } from "@/lib/navigation-paths";
import { useClientReady } from "./use-client-ready";
import ZeraWorldLogo from "./zera-logo";
export function PortalLogin({ supplier = false, next, whatsappSignup = false }: { supplier?: boolean; next?: string; whatsappSignup?: boolean }) {
  const ready = useClientReady();
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [challenge, setChallenge] = useState("");
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")); const password = String(form.get("password"));
    try {
      const endpoint = challenge ? "/api/auth/verify-otp" : register ? "/api/auth/register" : "/api/auth/login";
      const body = challenge ? { challengeId: challenge, code: form.get("code") } : register ? { email, password, fullName: form.get("fullName"), phone: form.get("phone"), whatsappEnabled: form.get("whatsappEnabled") === "on" } : { loginId: email, password, portal: supplier ? "SUPPLIER" : "CUSTOMER" };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message);
      if (result.requiresOtp) { setChallenge(result.challengeId); setChannel(result.channel === "whatsapp" ? "whatsapp" : "email"); setMessage(result.message); }
      else if (challenge && result.success) {
        if (!register) { window.location.assign(getPostLoginRedirectPath(supplier, next)); return; }
        setChallenge("");
        setRegister(false);
        setMessage(result.message || "Account verified successfully.");
      }
      else if (register) { setRegister(false); setMessage(result.message || "Account verified. You can now sign in."); }
      else window.location.assign(getPostLoginRedirectPath(supplier, next));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Sign in failed."); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#F7F4ED] p-5 text-[#173B35]"><div className="w-full max-w-md rounded-3xl border bg-white p-8">
    <Link href="/" className="inline-block font-black">{supplier ? <ZeraWorldLogo compact className="!w-[180px]" /> : "Zera's World"}</Link>
    <h1 className="my-5 text-3xl font-bold">{supplier ? "Supplier login" : challenge ? channel === "whatsapp" ? "Verify your WhatsApp number" : "Verify your email" : register ? "Create customer account" : "Customer login"}</h1>
    <form onSubmit={submit}><fieldset disabled={!ready || busy} className="space-y-4">
      {challenge ? <><p className="text-sm">{channel === "whatsapp" ? "Open WhatsApp and enter the six-digit code sent to your mobile number." : "Check your email, including your spam folder, for the six-digit verification code."}</p><label className="block text-sm">Verification code<input name="code" type="text" inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required autoComplete="one-time-code" autoFocus className="mt-2 w-full rounded-xl border p-3" /></label></> : <>
        {register ? <label className="block text-sm">Full name<input name="fullName" required maxLength={100} autoComplete="name" className="mt-2 w-full rounded-xl border p-3" /></label> : null}
        {register ? <><label className="block text-sm">WhatsApp mobile number<input name="phone" aria-describedby="signup-phone-help" type="tel" inputMode="tel" required maxLength={20} autoComplete="tel" placeholder="10-digit Indian mobile number" className="mt-2 w-full rounded-xl border p-3" /><span id="signup-phone-help" className="mt-2 block text-xs">{whatsappSignup ? "Enter a mobile number you use on WhatsApp. We?ll send your verification code there." : "Enter a mobile number you use on WhatsApp. Your verification code will arrive by email."}</span></label><label className="flex items-start gap-3 text-sm"><input type="checkbox" name="whatsappEnabled" className="mt-1" /><span>Send my order, payment and delivery updates to this number on WhatsApp. I can turn these off in My account.</span></label></> : null}
        <label className="block text-sm">{supplier ? "Login ID or email" : "Email"}<input name="email" type={supplier ? "text" : "email"} required autoComplete={supplier ? "username" : "email"} className="mt-2 w-full rounded-xl border p-3" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required minLength={register ? 12 : 6} autoComplete={register ? "new-password" : "current-password"} className="mt-2 w-full rounded-xl border p-3" /></label>
      </>}
      <button className="w-full rounded-xl bg-[#173B35] p-3 font-bold text-white">{busy ? "Please wait..." : challenge ? "Verify account" : register ? "Create account" : "Sign in"}</button>
    </fieldset></form>
    {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
    {!supplier && !register && !challenge ? <Link href="/forgot-password" className="mt-4 block text-sm underline">Forgot password?</Link> : null}
    {challenge ? <button type="button" disabled={busy} onClick={() => { setChallenge(""); setMessage(register ? "To request a new code, enter your account details again after one minute." : "To request a new code, sign in again after one minute."); }} className="mt-5 text-sm underline">{register ? "Change details or request a new code" : "Use another email or request a new code"}</button> : !supplier ? <button type="button" disabled={busy} onClick={() => { setRegister(!register); setMessage(""); }} className="mt-5 text-sm underline">{register ? "Already have an account? Sign in" : "Create an account"}</button> : <p className="mt-5 text-sm">Your store administrator provides supplier access after approval.</p>}
  </div></main>;
}
