import { AdminHeading } from "@/components/admin-ui";
import { SupportInbox } from "@/components/support-inbox";

export default function InboxPage() {
  return (
    <main className="mx-auto max-w-7xl p-5 md:p-8">
      <AdminHeading title="Inbox" description="Read and reply to customer email and WhatsApp messages." />
      <SupportInbox />
    </main>
  );
}
