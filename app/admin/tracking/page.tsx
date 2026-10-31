import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function TrackingPage() {
  await requireStoreAdmin();
  const shipments = await prisma.shipment.findMany({ include: { customerOrder: { select: { marketplaceOrderId: true, customerName: true } }, trackingEvents: { orderBy: { eventTime: "desc" }, take: 10 } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Tracking" description="Shipment references, carriers, delivery estimates and saved tracking events." /><AdminNotice>Carrier tracking is not connected yet. This page displays shipment and event records already saved to the store.</AdminNotice><AdminTable columns={["Order", "Customer", "Carrier / reference", "Status", "Expected delivery", "Events"]} empty="No shipments are recorded yet.">{shipments.map((shipment) => <tr key={shipment.id}><td className="font-semibold">{shipment.customerOrder.marketplaceOrderId}</td><td>{shipment.customerOrder.customerName || "Guest"}</td><td><p>{shipment.courierName || "Carrier not assigned"}</p><p className="mt-1 text-xs">{shipment.trackingNumber || "No tracking reference"}</p></td><td><StateBadge value={shipment.status} /></td><td>{adminDate(shipment.estimatedDelivery)}</td><td>{shipment.trackingEvents.length ? <details><summary className="cursor-pointer text-xs">View recent events</summary><ul className="mt-3 space-y-3 text-xs">{shipment.trackingEvents.map((event) => <li key={event.id}><p className="font-semibold">{event.eventType} · {adminDate(event.eventTime)}</p><p className="mt-1 text-[#173B35]/65">{event.description || ""}</p></li>)}</ul></details> : "No events"}</td></tr>)}</AdminTable></main>;
}
