"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";
export function AdminAccountEditor({ user }: { user: { fullName: string; email: string; loginId: string | null } }) {
  const ready = useClientReady();
  const [mode, setMode] = useState<"PROFILE" | "PASSWORD">("PROFILE");
  const [challenge, setChallenge] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(true); setMessage("");
    try {
      if (!challenge && mode === "PASSWORD" && data.get("newPassword") !== data.get("confirmPassword")) throw Error("New passwords do not match.");
      const body = challenge ? { challengeId: challenge, code: data.get("code") } : mode === "PROFILE" ? { purpose: mode, currentPassword: data.get("currentPassword"), profile: { fullName: data.get("fullName"), email: data.get("email"), loginId: data.get("loginId") } } : { purpose: mode, currentPassword: data.get("currentPassword"), newPassword: data.get("newPassword") };
      const response = await fetch(`/api/admin/account/${challenge ? "verify" : "request-code"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      if (challenge) window.location.assign("/admin/login");
      else { form.reset(); setChallenge(result.challengeId); setMessage(result.message); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Account could not be updated."); }
    finally { setBusy(false); }
  }
  const input = "mt-1 block w-full rounded-lg border px-3 py-2 text-sm";
  return <details className="min-w-64 max-w-sm"><summary className="cursor-pointer font-semibold underline">Edit account / change password</summary><p className="my-3 text-xs">Your administrator role remains protected. Changes require your current password and an email code. All sessions will be signed out after saving.</p>
    {!challenge ? <div className="mb-4 flex gap-3"><button type="button" disabled={busy} onClick={() => { setMode("PROFILE"); setMessage(""); }} aria-pressed={mode === "PROFILE"} className="text-sm underline">Edit account</button><button type="button" disabled={busy} onClick={() => { setMode("PASSWORD"); setMessage(""); }} aria-pressed={mode === "PASSWORD"} className="text-sm underline">Change password</button></div> : null}
    <form key={mode} onSubmit={submit}><fieldset disabled={!ready || busy} className="space-y-3">
      {challenge ? <label className="block text-xs">Email verification code<input name="code" required inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} autoComplete="one-time-code" className={input} /></label> : <>
        {mode === "PROFILE" ? <><label className="block text-xs">Full name<input name="fullName" defaultValue={user.fullName} required minLength={2} maxLength={100} autoComplete="name" className={input} /></label><label className="block text-xs">Email for verification<input name="email" type="email" defaultValue={user.email.includes("@") ? user.email : ""} required autoComplete="email" className={input} /></label><label className="block text-xs">Login ID<input name="loginId" defaultValue={user.loginId || (!user.email.includes("@") ? user.email : "")} required minLength={3} maxLength={80} pattern="[a-zA-Z0-9._-]+" autoComplete="username" className={input} /></label></> : <p className="text-xs">The code will be sent to your saved admin email. If no valid email is saved, verify one using Edit account first.</p>}
        <label className="block text-xs">Current password<input name="currentPassword" type="password" required autoComplete="current-password" className={input} /></label>
        {mode === "PASSWORD" ? <><label className="block text-xs">New password<input name="newPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={input} /></label><label className="block text-xs">Confirm new password<input name="confirmPassword" type="password" required minLength={12} maxLength={72} autoComplete="new-password" className={input} /></label></> : null}
      </>}
      <button className="rounded-lg bg-[#173B35] px-4 py-2 text-xs text-white">{busy ? "Please wait..." : challenge ? "Verify code and save" : "Send verification code"}</button>
    </fieldset></form>{message ? <p role="status" className="mt-3 text-xs">{message}</p> : null}
    {challenge ? <button type="button" disabled={busy} onClick={() => { setChallenge(""); setMessage("Wait one minute before requesting another code. Previous pending changes will be replaced."); }} className="mt-3 text-xs underline">Start again / request new code</button> : null}
  </details>;
}
