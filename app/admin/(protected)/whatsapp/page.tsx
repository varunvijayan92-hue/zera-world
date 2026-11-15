import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { WhatsAppStatus } from "@/components/whatsapp-status";

export default async function WhatsAppTestPage() {
  const user = await requireStoreAdmin();
  return <main className="mx-auto max-w-7xl p-5 text-[#173B35] sm:p-8"><Link href="/admin/settings" className="text-sm font-medium underline">Back to settings</Link><p className="mt-7 text-xs font-semibold uppercase tracking-[.2em] text-[#8A744F]">Customer communication</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">WhatsApp test studio</h1><WhatsAppStatus canEdit={user.role === "ADMIN"} /></main>;
}
