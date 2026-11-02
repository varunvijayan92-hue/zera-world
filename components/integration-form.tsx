"use client";
import { useState, type FormEvent } from "react";
import { useClientReady } from "./use-client-ready";
type Provider = "RAZORPAY" | "DELHIVERY" | "SHIPROCKET" | "AMAZON" | "FLIPKART";
const definitions: Record<Provider, { url: string; fields: [string, string, boolean][] }> = {
  RAZORPAY: { url: "https://api.razorpay.com/v1", fields: [["keyId", "Key ID", false], ["keySecret", "Key secret", true], ["webhookSecret", "Webhook secret (optional)", true]] },
  DELHIVERY: { url: "https://track.delhivery.com", fields: [["apiToken", "API token", true], ["pickupLocation", "Registered pickup location (optional)", false]] },
  SHIPROCKET: { url: "https://apiv2.shiprocket.in/v1/external", fields: [["email", "API user email", false], ["password", "API user password", true], ["pickupLocation", "Registered pickup location (optional)", false]] },
  AMAZON: { url: "https://sellingpartnerapi-eu.amazon.com", fields: [["sellerId", "Seller ID", false], ["marketplaceId", "Marketplace ID", false], ["clientId", "LWA client ID", false], ["clientSecret", "LWA client secret", true], ["refreshToken", "Authorized refresh token", true]] },
  FLIPKART: { url: "https://api.flipkart.net", fields: [["sellerId", "Seller ID", false], ["clientId", "Application client ID", false], ["clientSecret", "Application client secret", true]] },
};
export function IntegrationForm({ provider, saved, canEdit }: { provider: Provider; saved: boolean; canEdit: boolean }) {
  const ready = useClientReady(); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function checkShiprocket() {
    setBusy(true); setMessage("");
    try { const response = await fetch("/api/admin/integrations/shiprocket", { method: "POST" }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(`${result.message} ${result.locations.map((entry: { name: string }) => entry.name).join(", ")}`); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Connection check failed."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); const form = event.currentTarget;
    const data = new FormData(form); const credentials = Object.fromEntries(definitions[provider].fields.map(([key]) => [key, String(data.get(key) || "")]));
    try { const response = await fetch("/api/admin/integrations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, credentials }) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); form.reset(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Settings could not be saved."); } finally { setBusy(false); }
  }
  return <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">{provider}</h2><p className="my-3 text-sm">{saved ? "Credentials saved. Leave fields blank to keep saved values." : "No credentials saved in admin settings."}</p><label className="block text-sm">Official API URL<input readOnly value={definitions[provider].url} className="my-2 block w-full rounded-xl border bg-[#F7F4ED] p-3" /></label><form onSubmit={submit}><fieldset disabled={!ready || busy || !canEdit} className="space-y-3">{definitions[provider].fields.map(([key, label, secret]) => <label key={key} className="block text-sm">{label}<input name={key} type={secret ? "password" : "text"} autoComplete="off" maxLength={4096} className="mt-2 block w-full rounded-xl border p-3" /></label>)}<button className="rounded-xl bg-[#173B35] px-5 py-3 text-white disabled:opacity-50">{busy ? "Saving…" : "Save API settings"}</button></fieldset></form>{provider === "SHIPROCKET" ? <div className="mt-4 space-y-3 text-sm"><p>Create a dedicated API user in Shiprocket Settings ? API. Save its email and password here, then check the connection.</p><a href="https://app.shiprocket.in/seller/settings/company-setup/pickup-addresses" target="_blank" rel="noopener noreferrer" className="block font-semibold underline">Manage Shiprocket pickup addresses</a><button type="button" disabled={!ready || busy || !canEdit} onClick={checkShiprocket} className="rounded-xl border px-4 py-3 disabled:opacity-50">Check connection &amp; pickup locations</button></div> : null}{!canEdit ? <p className="mt-3 text-sm">Only administrators can change credentials.</p> : null}{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}<p className="mt-4 text-xs opacity-60">Credentials are encrypted on the server. Partner account approval and valid API access are required. The official endpoint is fixed to protect your credentials.</p></section>;
}
