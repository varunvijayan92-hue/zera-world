"use client";
import { useState } from "react";
export function AdminSignOut({ redirectTo = "/admin/login" }: { redirectTo?: string }) {
  const [busy, setBusy] = useState(false);
  return <button disabled={busy} onClick={async () => { setBusy(true); try { const result = await fetch("/api/auth/logout", { method: "POST" }); if (result.ok) window.location.href = redirectTo; } finally { setBusy(false); } }} className="text-sm font-semibold underline">{busy ? "Signing out..." : "Sign out"}</button>;
}
