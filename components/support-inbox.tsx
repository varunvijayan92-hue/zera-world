"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Message = {
  id: string; thread: string; channel: "EMAIL" | "WHATSAPP"; peer: string; subject: string | null;
  body: string; direction: string; status: string; createdAt: string;
};

async function inboxRequest(query: URLSearchParams, init?: RequestInit) {
  const response = await fetch(`/api/admin/inbox?${query}`, { ...init, cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.message || "Inbox request failed.");
  return result;
}

function contact(message: Message) {
  return message.channel === "WHATSAPP" ? `+${message.peer}` : message.peer;
}

function timestamp(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
}

export function SupportInbox() {
  const [channel, setChannel] = useState("");
  const [thread, setThread] = useState("");
  const [conversations, setConversations] = useState<Message[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const replyId = useRef<string | null>(null);

  const refresh = useCallback(async (signal: AbortSignal) => {
    try {
      const query = new URLSearchParams(channel ? { channel } : {});
      const [list, detail] = await Promise.all([
        inboxRequest(query, { signal }),
        thread ? inboxRequest(new URLSearchParams({ thread }), { signal }) : null,
      ]);
      if (!signal.aborted) {
        setConversations(list.data);
        setMessages(detail?.data || []);

      }
    } catch (failure) {
      if (!signal.aborted) setError(failure instanceof Error ? failure.message : "Inbox could not be loaded.");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [channel, thread]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh(controller.signal);
      if (!controller.signal.aborted) timer = setTimeout(poll, 15000);
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [refresh]);

  const lastIncoming = [...messages].reverse().find(message => message.direction === "INBOUND");
  const active = lastIncoming || messages[0];
  const closed = lastIncoming?.channel === "WHATSAPP" && Date.now() - Date.parse(lastIncoming.createdAt) >= 86400000;

  function select(nextThread: string) {
    setThread(nextThread); setMessages([]); setDraft(""); setError(""); setNotice(""); replyId.current = null;
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !thread || closed || inFlight.current) return;
    inFlight.current = true;
    setSending(true); setError(""); setNotice("");
    try {
      replyId.current ||= crypto.randomUUID();
      const result = await inboxRequest(new URLSearchParams(), {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread, body: draft, replyId: replyId.current }),
      });
      setDraft(""); replyId.current = null; setNotice(result.message);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Reply status could not be confirmed.");
    } finally {
      await refresh(new AbortController().signal);
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <section className="grid overflow-hidden rounded-2xl border bg-white lg:grid-cols-[20rem_1fr]">
      <aside className="border-b p-4 lg:border-b-0 lg:border-r">
        <label className="block text-sm font-semibold">Channel
          <select className="mt-2 block w-full rounded-lg border p-2" value={channel} disabled={sending}
            onChange={event => { setChannel(event.target.value); setLoading(true); select(""); }}>
            <option value="">All messages</option><option value="EMAIL">Email</option><option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>
        <div className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto">
          {!conversations.length && <p className="p-2 text-sm text-gray-600">{loading ? "Loading inbox…" : "No customer messages yet."}</p>}
          {conversations.map(item => (
            <button key={item.thread} type="button" aria-pressed={thread === item.thread} disabled={sending}
              onClick={() => { if (thread !== item.thread) select(item.thread); }} className="block w-full rounded-lg border p-3 text-left aria-pressed:border-[#173B35] aria-pressed:bg-[#edf2eb]">
              <p className="truncate text-sm font-semibold">{item.subject || contact(item)}</p>
              <p className="truncate text-xs text-gray-600">{item.channel === "EMAIL" ? "Email" : "WhatsApp"} · {contact(item)}</p>
              <p className="mt-1 truncate text-sm">{item.body}</p>
            </button>
          ))}
        </div>
      </aside>
      <div className="min-w-0 space-y-4 p-4 md:p-6">
        {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {!active ? <p className="text-sm text-gray-600">{thread ? "Loading conversation…" : "Select a conversation to read and reply."}</p> : <>
          <header><h2 className="break-words text-lg font-semibold">{active.subject || contact(active)}</h2><p className="break-all text-sm text-gray-600">{contact(active)}</p></header>
          <ol className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto rounded-xl bg-[#f7f8f5] p-4">
            {messages.map(item => (
              <li key={item.id} className={`max-w-[90%] rounded-xl border p-3 ${item.direction === "OUTBOUND" ? "self-end bg-[#e8f0e8]" : "self-start bg-white"}`}>
                <p className="whitespace-pre-wrap break-words text-sm">{item.body}</p>
                <p className="mt-2 text-xs text-gray-600">{timestamp(item.createdAt)}{item.direction === "OUTBOUND" ? ` · ${item.status.toLowerCase()}` : ""}</p>
              </li>
            ))}
          </ol>
          {closed ? <p className="text-sm text-gray-600">The WhatsApp reply window has closed. It reopens when the customer sends a new message.</p> : (
            <form onSubmit={send} className="space-y-2">
              <label className="block text-sm font-semibold">Reply
                <textarea className="mt-2 block w-full rounded-lg border p-3 font-normal" rows={3} maxLength={4096}
                  value={draft} disabled={sending} onChange={event => { setDraft(event.target.value); replyId.current = null; }} />
              </label>
              <button className="rounded-lg bg-[#173B35] px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={sending || !draft.trim()}>
                {sending ? "Sending…" : "Send reply"}
              </button>
            </form>
          )}
        </>}
      </div>
    </section>
  );
}
