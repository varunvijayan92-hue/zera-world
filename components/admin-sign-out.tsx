"use client";
import { useState } from "react";
export function AdminSignOut() {
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={async () => { setBusy(true); try { const result = await fetch("/api/auth/logout", { method: "POST" }); if (result.ok) window.location.href = "/admin/login"; } finally { setBusy(false); } }} className="text-sm font-semibold underline">{busy ? "Signing out..." : "Sign out"}</button>;
}
