"use client";
import { useState } from "react";

type Connection = { configured: boolean; approvedTemplates: number; numbers: { phoneNumberId: string; name: string; connectionStatus: string; templates: { messageId: string; name: string; status: string; variableCount: number }[] }[] };
type Queue = { enabled: boolean; templates: Record<string, string | undefined>; notifications: { id: string; event: string; status: string; lastError: string | null; order: { marketplaceOrderId: string } }[] };

export function WhatsAppStatus({ canEdit }: { canEdit: boolean }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function load(retry = false) {
    setBusy(true); setMessage("");
    try {
      if (retry) {
        const response = await fetch("/api/admin/whatsapp/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RETRY_PENDING" }) });
        const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message);
      }
      const responses = await Promise.all([fetch("/api/admin/integrations/whatsapp", { cache: "no-store" }), fetch("/api/admin/whatsapp/notifications", { cache: "no-store" })]);
      const results = await Promise.all(responses.map(response => response.json()));
      responses.forEach((response, index) => { if (!response.ok) throw Error(results[index].message || "WhatsApp setup could not be loaded."); });
      setConnection(results[0].data); setQueue(results[1].data);
    } catch (error) { setMessage(error instanceof Error ? error.message : "WhatsApp check failed."); }
    finally { setBusy(false); }
  }
  return <section className="mt-6 rounded-3xl border bg-white p-6"><h2 className="text-xl font-bold">WhatsApp order updates</h2><p className="mt-3 text-sm">Customers choose WhatsApp updates during registration or in My account. Order placement, verified payments, dispatch and delivery confirmation create notification records. Each event needs an approved template; provider acceptance is not delivery confirmation.</p><div className="my-4 flex flex-wrap gap-3"><button disabled={busy || !canEdit} onClick={() => load()} className="rounded-xl border px-4 py-3 disabled:opacity-50">Check connection, templates and queue</button><button disabled={busy || !canEdit} onClick={() => load(true)} className="rounded-xl border px-4 py-3 disabled:opacity-50">Retry eligible pending updates</button></div>{message ? <p role="status" className="my-3 text-sm">{message}</p> : null}{connection ? <div className="space-y-3 text-sm"><p>API key configured: {connection.configured ? "Yes" : "No"}. Approved templates: {connection.approvedTemplates}.</p>{connection.numbers.map(number => <div key={number.phoneNumberId} className="rounded-xl border p-4"><p>{number.name} · {number.connectionStatus}</p><p>Sender ID: {number.phoneNumberId}</p>{number.templates.map(template => <p key={template.messageId} className="mt-2">{template.name} · Message ID {template.messageId} · {template.status} · {template.variableCount} variable(s)</p>)}</div>)}</div> : null}{queue ? <div className="mt-5 space-y-3 text-sm"><p>Automatic notifications: {queue.enabled ? "Enabled for opted-in customers" : "Disabled"}.</p>{Object.entries(queue.templates).map(([event, id]) => <p key={event}>{event}: {id || "Template not configured"}</p>)}<h3 className="pt-3 font-bold">Recent updates</h3>{!queue.notifications.length ? <p>No WhatsApp order events yet.</p> : queue.notifications.map(item => <article key={item.id} className="rounded-xl border p-3"><p className="break-all">{item.order.marketplaceOrderId} · {item.event} · {item.status}</p>{item.lastError ? <p className="mt-2">{item.lastError}</p> : null}</article>)}</div> : null}</section>;
}
