// Auto‑generated WhatsApp test screen – matches site styling
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Send, CheckCheck, MessageCircle } from "lucide-react";
import {
  whatsappTemplateTitle,
  whatsappTestVariables,
  renderWhatsAppPreview,
  normalizeWhatsAppTestRecipient,
} from "@/lib/whatsapp-preview";

type Template = {
  messageId: string;
  name: string;
  status: string;
  supported: boolean;
  language: string;
  variableCount: number;
  mediaType: string | null;
  body: string;
  examples: string[];
};

type Connection = {
  configured: boolean;
  approvedTemplates: number;
  phoneNumberId: string;
  numbers: {
    phoneNumberId: string;
    name: string;
    connectionStatus: string;
    templates: Template[];
  }[];
};

export default function WhatsAppTestScreen() {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [senderId, setSenderId] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [variables, setVariables] = useState<string[]>([]);

  const attempts = useRef(new Map<string, { submissionId: string; result?: { requestId: string; status: string } }>());
  const inFlight = useRef(false);

  // Load connection & templates
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/admin/integrations/whatsapp", { cache: "no-store" });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message ?? "Failed to load WhatsApp config");
      setConnection(data.data);
      // pick default sender (connected & has templates)
      const defaultSender = data.data.numbers.find((n: any) => n.connectionStatus.toUpperCase() === "CONNECTED")?.phoneNumberId || data.data.phoneNumberId || "";
      setSenderId(defaultSender);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // When sender changes, reset template selection
  useEffect(() => {
    if (!connection) return;
    const sender = connection.numbers.find((n) => n.phoneNumberId === senderId);
    const firstApproved = sender?.templates.find((t) => t.supported && !t.mediaType && t.status.toUpperCase() === "APPROVED");
    if (firstApproved) {
      setTemplateId(firstApproved.messageId);
      setVariables(whatsappTestVariables(firstApproved.name, firstApproved.variableCount, firstApproved.examples));
    } else {
      setTemplateId("");
      setVariables([]);
    }
  }, [senderId, connection]);

  const selectedTemplate = connection?.numbers
    .find((n) => n.phoneNumberId === senderId)
    ?.templates.find((t) => t.messageId === templateId);

  const number = normalizeWhatsAppTestRecipient(recipient);
  const canSend =
    selectedTemplate &&
    selectedTemplate.supported &&
    !selectedTemplate.mediaType &&
    selectedTemplate.status.toUpperCase() === "APPROVED" &&
    number &&
    variables.length === selectedTemplate.variableCount &&
    !sending &&
    !inFlight.current;

  const preview = selectedTemplate ? renderWhatsAppPreview(selectedTemplate.body, variables) : "Select a template to preview";

  async function sendTest() {
    if (!canSend || !selectedTemplate) return;
    inFlight.current = true;
    setSending(true);
    setError("");
    setMessage("");
    try {
      const fingerprint = JSON.stringify({ phoneNumberId: senderId, messageId: templateId, to: number, variables });
      const attempt = attempts.current.get(fingerprint) || { submissionId: crypto.randomUUID() };
      attempts.current.set(fingerprint, attempt);

      const body = JSON.stringify({
        submissionId: attempt.submissionId,
        phoneNumberId: senderId,
        messageId: templateId,
        to: number,
        variables,
      });
      const resp = await fetch("/api/admin/whatsapp/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.message ?? "Send failed");
      attempt.result = json.data;
      setMessage("Test accepted – check the recipient WhatsApp client.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected send error");
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-5 bg-[#173B35] px-6 py-7 text-white">
        <h2 className="text-2xl font-semibold">WhatsApp Test Console</h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/25 px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Refresh
        </button>
      </header>
      <div className="p-6">
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Sender selection */}
          <div>
            <label className="block text-sm font-medium text-[#173B35]/70">WhatsApp Sender</label>
            <select
              className="mt-1 w-full rounded-xl border border-[#173B35]/20 px-3 py-2"
              value={senderId}
              onChange={(e) => setSenderId(e.target.value)}
            >
              {connection?.numbers.map((n) => (
                <option key={n.phoneNumberId} value={n.phoneNumberId}>
                  {n.name} ({n.connectionStatus})
                </option>
              ))}
            </select>
          </div>
          {/* Template picker */}
          <div>
            <label className="block text-sm font-medium text-[#173B35]/70">Template</label>
            <select
              className="mt-1 w-full rounded-xl border border-[#173B35]/20 px-3 py-2"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                const tmpl = connection?.numbers
                  .find((n) => n.phoneNumberId === senderId)
                  ?.templates.find((t) => t.messageId === e.target.value);
                if (tmpl) setVariables(whatsappTestVariables(tmpl.name, tmpl.variableCount, tmpl.examples));
              }}
            >
              <option value="">-- select --</option>
              {connection?.numbers
                .find((n) => n.phoneNumberId === senderId)
                ?.templates.map((t) => (
                  <option key={t.messageId} value={t.messageId}>
                    {whatsappTemplateTitle(t.name)} ({t.status})
                  </option>
                ))}
            </select>
          </div>
          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-[#173B35]/70">Recipient (Indian mobile)</label>
            <input
              className="mt-1 w-full rounded-xl border border-[#173B35]/20 px-3 py-2"
              placeholder="+91 98765 43210"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            />
          </div>
          {/* Variables */}
          {selectedTemplate && (
            <div>
              <label className="block text-sm font-medium text-[#173B35]/70">Variables ({selectedTemplate.variableCount})</label>
              {variables.map((val, i) => (
                <input
                  key={i}
                  className="mt-1 w-full rounded-xl border border-[#173B35]/20 px-3 py-2"
                  placeholder={`Variable ${i + 1}`}
                  value={val}
                  onChange={(e) => {
                    const newVars = [...variables];
                    newVars[i] = e.target.value;
                    setVariables(newVars);
                  }}
                />
              ))}
            </div>
          )}
        </div>
        {/* Preview */}
        <div className="mt-4 rounded-xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
          <h3 className="mb-2 text-sm font-medium text-[#173B35]/70">Preview</h3>
          <p className="whitespace-pre-wrap text-sm text-[#173B35]">{preview}</p>
        </div>
        {/* Send button */}
        <div className="mt-4 flex items-center">
          <button
            type="button"
            disabled={!canSend}
            onClick={sendTest}
            className="inline-flex items-center gap-2 rounded-xl bg-[#173B35] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Test
          </button>
          {message && <span className="ml-4 text-sm text-green-700">{message}</span>}
        </div>
      </div>
    </section>
  );
}
