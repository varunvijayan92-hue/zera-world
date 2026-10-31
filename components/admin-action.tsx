"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function AdminAction({ url, label, body = {}, confirm }: { url: string; label: string; body?: unknown; confirm?: string }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const router = useRouter();
  return <div><button disabled={busy} className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50" onClick={async () => { if (confirm && !window.confirm(confirm)) return; setBusy(true); setMessage(""); try { const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw Error(result.message); setMessage(result.message); router.refresh(); } catch (error) { setMessage(error instanceof Error ? error.message : "Action failed."); } finally { setBusy(false); } }}>{busy ? "Please wait…" : label}</button>{message ? <p role="status" className="mt-2 max-w-xs text-xs">{message}</p> : null}</div>;
}
