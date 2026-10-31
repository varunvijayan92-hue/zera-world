"use client";

import { LocateFixed } from "lucide-react";
import { useState, type Dispatch, type SetStateAction } from "react";
import type { DeliveryAddress } from "@/lib/checkout-storage";

const fields: { key: keyof DeliveryAddress; label: string; type?: string; autoComplete: string; required?: boolean; wide?: boolean }[] = [
  { key: "fullName", label: "Full name", autoComplete: "name", required: true },
  { key: "phone", label: "Phone number", type: "tel", autoComplete: "tel", required: true },
  { key: "email", label: "Email address", type: "email", autoComplete: "email", required: true, wide: true },
  { key: "addressLine1", label: "House / flat number and street", autoComplete: "address-line1", required: true, wide: true },
  { key: "addressLine2", label: "Area / locality (optional)", autoComplete: "address-line2", wide: true },
  { key: "city", label: "City", autoComplete: "address-level2", required: true },
  { key: "state", label: "State", autoComplete: "address-level1", required: true },
  { key: "pincode", label: "PIN / postal code", autoComplete: "postal-code", required: true },
  { key: "country", label: "Country", autoComplete: "country-name", required: true },
  { key: "landmark", label: "Landmark (optional)", autoComplete: "off", wide: true },
];

export function DeliveryAddressFields({ value, onChange, onLocatingChange }: {
  value: DeliveryAddress; onChange: Dispatch<SetStateAction<DeliveryAddress>>; onLocatingChange: (value: boolean) => void;
}) {
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  async function locate() {
    setMessage("");
    if (!window.isSecureContext || !navigator.geolocation) {
      setMessage("Location needs HTTPS or localhost and a browser with location support. You can enter the address below.");
      return;
    }
    setLocating(true);
    onLocatingChange(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
      });
      const response = await fetch("/api/address/locate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      });
      const result = await response.json();
      if (!response.ok || !result.address) throw new Error(result.message || "Address lookup failed. Enter the address below.");
      onChange((current) => ({ ...current, ...result.address }));
      setMessage("Location found. Check the address and add your house / flat number before confirming.");
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error) {
        setMessage(error.code === 1 ? "Location permission was denied. Enter your address manually, or allow location access and try again." : "Your location could not be found. Try again or enter your address below.");
      } else setMessage(error instanceof Error ? error.message : "Address lookup failed. Enter your address manually.");
    } finally { setLocating(false); onLocatingChange(false); }
  }
  return <>
    <button type="button" onClick={locate} disabled={locating} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#173B35]/20 bg-[#F7F4ED] px-4 py-3 text-sm font-semibold disabled:opacity-50">
      <LocateFixed size={17} /> {locating ? "Finding your address…" : "Use my current location"}
    </button>
    <p className="mt-2 text-xs text-[#173B35]/65">Allow location access to suggest your delivery address, then check the details.</p>
    {message ? <div role="status" aria-live="polite" className="mt-3 rounded-xl bg-[#F7F4ED] p-3 text-sm">{message}<p className="mt-1 text-xs text-[#173B35]/60">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap contributors</a></p></div> : null}
    <fieldset disabled={locating} className="mt-5 grid gap-4 md:grid-cols-2">
      <legend className="sr-only">Contact and delivery address</legend>
      {fields.map((field) => <label key={field.key} className={`text-sm font-medium text-[#173B35]/80 ${field.wide ? "md:col-span-2" : ""}`}>
        {field.label}
        <input name={field.key} type={field.type || "text"} autoComplete={field.autoComplete} required={field.required}
          minLength={field.key === "phone" ? 6 : field.key === "pincode" ? 3 : undefined}
          value={value[field.key] || ""} onChange={(event) => onChange((current) => ({ ...current, [field.key]: event.target.value }))}
          className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-white px-3 py-3 outline-none focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10 disabled:opacity-60" />
      </label>)}
    </fieldset>
  </>;
}
