"use client";
import { useState } from "react";
import { AdminAction } from "./admin-action";
export function ReturnReview({ id, status }: { id: string; status: string }) {
  const [notes, setNotes] = useState("");
  if (!["OPEN", "APPROVED"].includes(status)) return null;
  return <div className="space-y-2"><textarea aria-label="Return review notes" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} placeholder="Customer-visible notes" className="w-48 rounded-lg border p-2 text-xs" />{status === "OPEN" ? <><AdminAction url={`/api/admin/returns/${id}`} label="Approve return" body={{ action: "APPROVED", notes }} /><AdminAction url={`/api/admin/returns/${id}`} label="Reject return" body={{ action: "REJECTED", notes }} confirm="Reject this return request?" /></> : <AdminAction url={`/api/admin/returns/${id}`} label="Confirm item received" body={{ action: "RECEIVED", notes }} confirm="Confirm the returned item has physically been received? This does not issue a refund." />}</div>;
}
