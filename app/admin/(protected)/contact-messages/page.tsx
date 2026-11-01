import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";
import { adminDate } from "@/lib/admin-format";
export default async function ContactMessagesPage() {
  await requireStoreAdmin();
  const messages = await prisma.auditLog.findMany({ where: { action: "CONTACT_REQUEST", entityType: "ContactMessage" }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Contact requests" description="Latest 100 messages submitted through the website Contact Us form." /><AdminNotice>Messages are saved here. Email delivery is not configured; reply to the customer using your business support mailbox.</AdminNotice><AdminTable columns={["Customer", "Order / subject", "Message", "Reference", "Received"]} empty="No website contact messages yet.">{messages.map((entry) => { const details = entry.details && typeof entry.details === "object" && !Array.isArray(entry.details) ? entry.details as Record<string, unknown> : {}; const field = (key: string) => typeof details[key] === "string" ? details[key] as string : ""; return <tr key={entry.id}><td><strong>{field("fullName")}</strong><p className="mt-2 break-all text-xs">{field("email")}</p></td><td>{field("subject")}<p className="mt-2 text-xs">{field("orderNumber") || "No order reference"}</p></td><td className="max-w-md whitespace-pre-wrap break-words">{field("message")}</td><td className="max-w-40 break-all text-xs">{entry.entityId}</td><td>{adminDate(entry.createdAt)}</td></tr>; })}</AdminTable></main>;
}
