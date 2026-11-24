"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, CheckCheck, Clock3, CreditCard, Loader2, MessageCircle, PackageCheck, RefreshCw, Send, ShieldCheck, Smartphone, Truck } from "lucide-react";
import { normalizeWhatsAppTestRecipient, renderWhatsAppPreview, whatsappTemplateTitle, whatsappTestVariables } from "@/lib/whatsapp-preview";

type Template = { messageId: string; name: string; status: string; supported: boolean; language: string; variableCount: number; mediaType: string | null; body: string; examples: string[] };
type Connection = { configured: boolean; approvedTemplates: number; phoneNumberId: string; numbers: { phoneNumberId: string; name: string; connectionStatus: string; templates: Template[] }[] };
type Queue = { enabled: boolean; notifications: { id: string; event: string; status: string; lastError: string | null; order: { marketplaceOrderId: string } }[] };
type SendResult = { requestId: string; status: string };

function TemplateIcon({ name }: { name: string }) {
  const Icon = name.includes("payment") ? CreditCard : name.includes("shipped") ? Truck : name.includes("delivered") ? PackageCheck : MessageCircle;
  return <Icon className="h-5 w-5" aria-hidden="true" />;
}

export function WhatsAppStatus({ canEdit }: { canEdit: boolean }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [loading, setLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [senderId, setSenderId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [variables, setVariables] = useState<string[]>([]);
  const [result, setResult] = useState<SendResult | null>(null);
  const attempts = useRef(new Map<string, { submissionId: string; result?: SendResult }>());
  const inFlight = useRef(false);
  const sender = connection?.numbers.find(number => number.phoneNumberId === senderId);
  const selected = sender?.templates.find(template => template.messageId === templateId);
  const connected = sender?.connectionStatus.toUpperCase() === "CONNECTED";
  const approved = selected?.status.toUpperCase() === "APPROVED";
  const number = normalizeWhatsAppTestRecipient(recipient);
  const fingerprint = JSON.stringify({ phoneNumberId: senderId, messageId: templateId, to: number, variables });
  const alreadyAccepted = Boolean(attempts.current.get(fingerprint)?.result);
  const validVariables = selected && variables.length === selected.variableCount && variables.every(value => value.trim() && value.length <= 1024 && !value.includes("|"));
  const canSend = canEdit && connected && approved && selected?.supported && number && validVariables && !selected?.mediaType && !sending && !alreadyAccepted;
  const preview = selected ? renderWhatsAppPreview(selected.body, variables) : "Select a template to preview your message.";

  function selectTemplate(template: Template) {
    setTemplateId(template.messageId);
    setVariables(whatsappTestVariables(template.name, template.variableCount, template.examples));
    setResult(null); setError(""); setMessage("");
  }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const responses = await Promise.all([fetch("/api/admin/integrations/whatsapp", { cache: "no-store" }), fetch("/api/admin/whatsapp/notifications", { cache: "no-store" })]);
      const results = await Promise.all(responses.map(response => response.json()));
      responses.forEach((response, index) => { if (!response.ok) throw Error(results[index].message || "WhatsApp setup could not be loaded."); });
      const data: Connection = results[0].data;
      setConnection(data); setQueue(results[1].data);
      setSenderId(current => data.numbers.some(item => item.phoneNumberId === current) ? current : data.phoneNumberId || data.numbers.find(item => item.connectionStatus.toUpperCase() === "CONNECTED")?.phoneNumberId || data.numbers[0]?.phoneNumberId || "");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "WhatsApp check failed."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (canEdit) void load(); }, [canEdit, load]);
  useEffect(() => {
    if (!sender) return;
    if (!sender.templates.some(template => template.messageId === templateId)) {
      const first = sender.templates.find(template => template.status.toUpperCase() === "APPROVED") || sender.templates.find(template => template.name.includes("order_placed")) || sender.templates[0];
      if (first) selectTemplate(first);
      else { setTemplateId(""); setVariables([]); }
    }
  }, [sender, templateId]);

  async function sendTest() {
    if (!canSend || !selected || inFlight.current) return;
    inFlight.current = true; setSending(true); setError(""); setMessage(""); setResult(null);
    try {
      const attempt = attempts.current.get(fingerprint) || { submissionId: crypto.randomUUID() };
      attempts.current.set(fingerprint, attempt);
      const response = await fetch("/api/admin/whatsapp/messages", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId: attempt.submissionId, phoneNumberId: senderId, messageId: templateId, to: number, variables }) });
      const body = await response.json();
      if (!response.ok) throw Error(body.message || "The test message could not be sent.");
      attempt.result = body.data; setResult(body.data);
      setMessage("Test accepted by Meta. Check the recipient's WhatsApp for delivery.");
    } catch (failure) { setError(failure instanceof TypeError || failure instanceof SyntaxError ? "Send status is unknown. Check Meta WhatsApp Manager before starting another test. Retrying identical details keeps the same request ID." : failure instanceof Error ? failure.message : "The test message could not be confirmed. Check Meta WhatsApp Manager before retrying."); }
    finally { inFlight.current = false; setSending(false); }
  }

  async function retryQueue() {
    setRetrying(true); setError("");
    try {
      const response = await fetch("/api/admin/whatsapp/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "RETRY_PENDING" }) });
      const body = await response.json(); if (!response.ok) throw Error(body.message); setMessage(body.message); await load();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Pending updates could not be checked."); }
    finally { setRetrying(false); }
  }

  return <section className="mt-6 overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-white shadow-sm">
    <header className="flex flex-wrap items-center justify-between gap-5 bg-[#173B35] px-6 py-7 text-white sm:px-8">
      <div className="flex items-center gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10"><MessageCircle className="h-6 w-6" aria-hidden="true" /></div><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-[#D5C8A6]">Zera&apos;s World · Messaging</p><h2 className="mt-1 text-2xl font-semibold">A little update. A better experience.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/70">Preview your order messages, choose a test number, and check how they arrive on WhatsApp.</p></div></div>
      <button type="button" disabled={loading || sending || !canEdit} onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Refresh status</button>
    </header>
    {!canEdit ? <p className="p-6 text-sm">Only administrators can configure or send WhatsApp tests.</p> : <>
      <div className="grid gap-px border-b bg-[#173B35]/10 sm:grid-cols-3">
        {[{ label: "Business sender", value: loading && !connection ? "Checking…" : connected ? "Connected" : "Not connected", icon: Smartphone }, { label: "Ready to send", value: `${sender?.templates.filter(template => template.status.toUpperCase() === "APPROVED").length || 0} approved templates`, icon: ShieldCheck }, { label: "Order updates", value: queue?.enabled ? "Enabled for opted-in customers" : "Automatic updates disabled", icon: PackageCheck }].map(item => <div key={item.label} className="flex items-center gap-3 bg-[#FAFBF8] px-6 py-5"><item.icon className="h-5 w-5 shrink-0 text-[#55766B]" aria-hidden="true" /><div><p className="text-xs text-[#173B35]/60">{item.label}</p><p className="mt-1 text-sm font-semibold text-[#173B35]">{item.value}</p></div></div>)}
      </div>
      <div className="grid gap-8 p-5 sm:p-8 lg:grid-cols-[1.15fr_.85fr]">
        <div className="min-w-0 space-y-6">
          <div><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EDF2EB] text-xs font-bold text-[#173B35]">1</span><h3 className="font-semibold text-[#173B35]">Choose your message</h3></div><p className="mt-2 text-sm text-[#173B35]/60">Select a template, then personalize the sample details below.</p></div>
          {connection && !connection.configured ? <p className="rounded-xl bg-[#F7F4ED] p-4 text-sm">Save the Meta sender credentials in Admin Settings, then refresh.</p> : null}
          {connection?.configured && !sender?.templates.length ? <p className="rounded-xl bg-[#F7F4ED] p-4 text-sm">No templates are available for this sender. Check your WhatsApp Business Account in Meta, then refresh.</p> : null}
          {connection && connection.numbers.length > 1 ? <label className="block text-sm font-medium">Business sender<select aria-label="Business sender" disabled={sending} value={senderId} onChange={event => setSenderId(event.target.value)} className="mt-2 block min-h-11 w-full rounded-xl border p-3">{connection.numbers.map(item => <option key={item.phoneNumberId} value={item.phoneNumberId}>{item.name || item.phoneNumberId} · {item.connectionStatus}</option>)}</select></label> : null}
          <div className="grid gap-3 sm:grid-cols-2" role="group" aria-label="WhatsApp message templates">{sender?.templates.map(template => {
            const active = template.messageId === templateId, ready = template.status.toUpperCase() === "APPROVED";
            return <button key={template.messageId} type="button" disabled={sending} aria-pressed={active} onClick={() => selectTemplate(template)} className={`min-w-0 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50 ${active ? "border-[#173B35] bg-[#EDF2EB] ring-1 ring-[#173B35]" : "border-[#173B35]/15 hover:border-[#173B35]/40"}`}><div className="flex items-start justify-between gap-2"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-[#173B35] text-white" : "bg-[#F5F5EF] text-[#55766B]"}`}><TemplateIcon name={template.name} /></div>{active ? <Check className="h-4 w-4 text-[#173B35]" aria-label="Selected" /> : null}</div><p className="mt-3 font-semibold text-[#173B35]">{whatsappTemplateTitle(template.name)} ({template.language})</p><span className={`mt-2 inline-flex items-center gap-1 text-xs ${ready ? "text-emerald-700" : "text-amber-700"}`}>{ready ? <Check className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{ready ? "Approved" : template.status}</span></button>;
          })}</div>
          <div className="space-y-4 border-t border-[#173B35]/10 pt-6"><div className="flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EDF2EB] text-xs font-bold text-[#173B35]">2</span><h3 className="font-semibold text-[#173B35]">Make it your test</h3></div>
            <label className="block text-sm font-medium text-[#173B35]">Test WhatsApp number<input type="tel" inputMode="tel" autoComplete="tel" value={recipient} disabled={sending} onChange={event => { setRecipient(event.target.value); setResult(null); }} placeholder="+91 98765 43210" maxLength={20} className="mt-2 block min-h-12 w-full rounded-xl border border-[#173B35]/20 bg-white p-3 outline-none focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10" /><span className="mt-2 block text-xs font-normal leading-5 text-[#173B35]/60">Use your own number or someone expecting this test. Only this number receives the selected message.</span></label>
            {selected && variables.map((value, index) => <label key={`${selected.messageId}-${index}`} className="block text-sm font-medium text-[#173B35]">{selected.variableCount === 1 ? "Sample details" : `Template value ${index + 1}`}<textarea rows={3} value={value} disabled={sending} maxLength={1024} onChange={event => { setVariables(current => current.map((item, position) => position === index ? event.target.value : item)); setResult(null); }} className="mt-2 block w-full resize-y rounded-xl border border-[#173B35]/20 p-3 text-sm leading-6 outline-none focus:border-[#173B35] focus:ring-2 focus:ring-[#173B35]/10" /></label>)}
            {selected && !approved ? <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><p className="font-semibold">Preview ready. Sending awaits approval.</p><p>Meta currently reports this template as {selected.status.toLowerCase()}. Refresh after approval to enable a test send.</p><a href="https://business.facebook.com/wa/manage/" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold underline">Open Meta <ArrowUpRight className="h-3 w-3" /></a></div> : null}
            {selected && !selected.supported ? <p className="text-sm text-amber-800">This template uses components the store does not support.</p> : null}
            {selected?.mediaType ? <p className="text-sm text-amber-800">This template needs an attachment. The text-only test studio does not send media templates.</p> : null}
            <button type="button" disabled={!canSend} onClick={() => void sendTest()} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173B35] px-5 py-3 font-semibold text-white transition hover:bg-[#245147] disabled:cursor-not-allowed disabled:bg-[#173B35]/30">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : alreadyAccepted ? <CheckCheck className="h-4 w-4" /> : <Send className="h-4 w-4" />}{sending ? "Sending test…" : alreadyAccepted ? "Test already accepted" : "Send test WhatsApp"}</button>
            <p className="text-xs leading-5 text-[#173B35]/50">A send uses your Meta WhatsApp account. Previewing creates no order, payment or notification.</p>
            {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">{error}</p> : null}
            {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">{message}</p> : null}
            {result ? <div className="rounded-xl border border-[#173B35]/15 p-4 text-sm"><p className="font-semibold">Accepted · delivery not yet confirmed</p><p className="mt-2 break-all text-xs text-[#173B35]/60">Provider reference: {result.requestId}</p></div> : null}
          </div>
        </div>
        <aside className="min-w-0 lg:pl-3"><div className="sticky top-6"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-[#173B35]">Message preview</h3><span className="rounded-full bg-[#EDF2EB] px-3 py-1 text-xs font-medium text-[#55766B]">Test mode</span></div><div className="mx-auto max-w-[370px] overflow-hidden rounded-[30px] border-[7px] border-[#223C35] bg-[#EAE8DF] shadow-xl"><div className="flex items-center gap-3 bg-[#075E54] px-4 py-5 text-white"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F6F2E8] font-serif text-lg font-bold text-[#173B35]">Z</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{sender?.name || "Zera's World"}</p><p className="mt-1 text-[11px] text-white/70">Business account</p></div><ShieldCheck className="ml-auto h-4 w-4 shrink-0 text-white/70" /></div><div className="min-h-[370px] px-4 py-5" style={{ backgroundImage: "radial-gradient(#173b3510 1px, transparent 1px)", backgroundSize: "18px 18px" }}><div className="mx-auto mb-5 w-fit rounded-md bg-[#DFE9EC] px-3 py-1 text-[10px] font-medium text-[#48625C]">PREVIEW · NOT SENT</div><div className="rounded-xl rounded-tl-none bg-white p-4 shadow-sm"><p data-testid="whatsapp-message-preview" className="whitespace-pre-wrap break-words text-[13px] leading-[1.65] text-[#243932]">{preview}</p><div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-[#789087]"><span>Preview</span><CheckCheck className="h-3 w-3" /></div></div></div><div className="border-t border-black/5 bg-white/80 px-4 py-3 text-center text-[11px] text-[#55766B]">{number ? `Test recipient: +91 ${number.slice(0, 5)} ${number.slice(5)}` : "Add a test number to begin"}</div></div><p className="mt-4 text-center text-xs leading-5 text-[#173B35]/50">Uses the actual template text from your provider.<br />Formatting may vary slightly on the recipient&apos;s phone.</p></div></aside>
      </div>
      <div className="border-t border-[#173B35]/10 bg-[#FAFBF8] p-5 sm:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-[#173B35]">Customer update queue</h3><p className="mt-1 text-xs text-[#173B35]/60">Recent order notifications, separate from manual tests.</p></div><button type="button" disabled={retrying || sending || !queue} onClick={() => void retryQueue()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#173B35]/20 bg-white px-4 py-2 text-sm font-semibold text-[#173B35] disabled:opacity-50">{retrying ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}Retry eligible updates</button></div>
        <div className="mt-4 space-y-3">{!queue?.notifications.length ? <div className="flex items-center gap-3 rounded-2xl border border-dashed border-[#173B35]/20 bg-white p-5"><MessageCircle className="h-5 w-5 text-[#8EA695]" /><div><p className="text-sm font-medium text-[#173B35]">No customer updates yet</p><p className="mt-1 text-xs text-[#173B35]/60">New opted-in orders appear here when their events are queued.</p></div></div> : queue.notifications.map(item => <article key={item.id} className="rounded-xl border border-[#173B35]/10 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-all text-sm font-medium text-[#173B35]">{item.order.marketplaceOrderId}</p><span className="rounded-full bg-[#EDF2EB] px-2 py-1 text-[11px] font-semibold text-[#55766B]">{item.status}</span></div><p className="mt-2 text-xs text-[#173B35]/60">{item.event.replaceAll("_", " ")}</p>{item.lastError ? <p className="mt-2 text-xs leading-5 text-amber-800">{item.lastError}</p> : null}</article>)}</div>
      </div>
    </>}
  </section>;
}
