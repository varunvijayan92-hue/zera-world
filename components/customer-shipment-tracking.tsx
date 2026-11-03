"use client";
import { useState } from "react";

export type CustomerShipment = {
  id: string; courierName: string | null; trackingNumber: string | null; status: string;
  estimatedDelivery: string | null; shared?: boolean;
  trackingEvents: { id: string; eventType: string; description: string | null; eventTime: string }[];
};
const label = (value: string) => value.replaceAll("_", " ");
const date = (value: string) => new Date(value).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

export function CustomerShipmentTracking({ shipments, status, onRefresh }: { shipments: CustomerShipment[]; status?: string; onRefresh: (id: string) => Promise<void> }) {
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!shipments.length) return <p className="mt-2 text-sm text-[#173B35]/70">{status ? `${label(status)}. ` : ""}Tracking will appear here after dispatch.</p>;
  return <div className="mt-3 space-y-3" aria-label="Shipment tracking">
    {shipments.map(shipment => <section key={shipment.id} className="min-w-0 rounded-xl bg-[#F7F4ED] p-3 text-sm">
      <p className="font-semibold">{label(shipment.trackingEvents[0]?.eventType || shipment.status)}</p>
      <p className="mt-1 break-words">{shipment.courierName || "Delivery partner"} · AWB: {shipment.trackingNumber || "Awaiting dispatch"}</p>
      {shipment.shared ? <p className="mt-1 text-xs opacity-70">Tracking for this dispatch group. Packages may contain different items.</p> : null}
      {shipment.estimatedDelivery ? <p className="mt-1 text-xs">Estimated delivery: {date(shipment.estimatedDelivery)} IST</p> : null}
      {shipment.trackingEvents.length ? <ol aria-label="Tracking updates" className="mt-3 max-h-60 space-y-3 overflow-y-auto">{shipment.trackingEvents.map(event => <li key={event.id} className="border-l-2 border-[#173B35]/20 pl-3"><p className="font-medium">{label(event.eventType)}</p>{event.description ? <p className="break-words text-xs">{event.description}</p> : null}<time dateTime={event.eventTime} className="text-xs opacity-65">{date(event.eventTime)} IST</time></li>)}</ol> : <p className="mt-2 text-xs">Waiting for the first courier update.</p>}
      {shipment.trackingNumber && ["shiprocket", "delhivery"].includes(shipment.courierName?.toLowerCase() || "") ? <button type="button" disabled={refreshing !== null} className="mt-3 rounded-lg border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50" onClick={async () => { setRefreshing(shipment.id); setError(""); try { await onRefresh(shipment.id); } catch (cause) { setError(cause instanceof Error ? cause.message : "Tracking could not be refreshed."); } finally { setRefreshing(null); } }}>{refreshing === shipment.id ? "Refreshing..." : "Refresh tracking"}</button> : null}
    </section>)}
    {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
  </div>;
}
