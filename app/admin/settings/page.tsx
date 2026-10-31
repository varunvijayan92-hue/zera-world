import { requireStoreAdmin } from "@/lib/admin-page";
import { getBaseUrl } from "@/lib/site";
import { inr } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable } from "@/components/admin-ui";

export default async function SettingsPage() {
  await requireStoreAdmin();
  const configuration = [
    ["Store", "ZeraWorld"], ["Website URL", getBaseUrl()], ["Checkout currency", "INR"],
    ["Current delivery charge", inr(120)], ["Current checkout tax rate", "5%"],
    ["Cloudinary cloud", process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "Not configured"],
    ["Cloudinary server credentials", process.env.CLOUDINARY_URL ? "Present" : "Not configured"],
    ["Razorpay API credentials", process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "Present" : "Not configured"],
    ["Razorpay webhook secret", process.env.RAZORPAY_WEBHOOK_SECRET ? "Present" : "Not configured"],
    ["Supplier automation", "Connector not configured"], ["Carrier integration", "Connector not configured"],
  ];
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Settings" description="Current storefront and integration configuration." /><AdminNotice>This screen shows the current configuration without exposing private credentials. Credential presence is not a live connection test. Deployment credentials and checkout pricing rules are currently configured outside this panel; this page is read-only.</AdminNotice><AdminTable columns={["Setting", "Current value"]}>{configuration.map(([name, value]) => <tr key={name}><td className="font-semibold">{name}</td><td className="break-all">{value}</td></tr>)}</AdminTable></main>;
}
