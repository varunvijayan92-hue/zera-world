import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AdminAction } from "@/components/admin-action";
import Link from "next/link";
export const dynamic = "force-dynamic";
export default async function TrackOrderPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const user = await getCurrentUser(); if (!user || user.role !== "CUSTOMER") redirect("/login");
  const { order } = await searchParams;
  const shipments = await prisma.shipment.findMany({ where: { customerOrder: { customerId: user.id, ...(order ? { id: order } : {}) } }, include: { customerOrder: { select: { marketplaceOrderId: true } }, trackingEvents: { orderBy: { eventTime: "desc" }, take: 30 } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <main className="min-h-screen bg-[#F7F4ED] p-6 text-[#173B35]"><div className="mx-auto max-w-3xl"><Link href="/account" className="underline">My account</Link><h1 className="my-6 text-3xl font-bold">Track my orders</h1>{!shipments.length ? <p>No shipments yet. Tracking appears after dispatch.</p> : shipments.map((shipment) => <article key={shipment.id} className="mb-5 rounded-3xl border bg-white p-6"><h2 className="font-bold">{shipment.customerOrder.marketplaceOrderId}</h2><p className="my-3">{shipment.courierName} · {shipment.trackingNumber} · {shipment.status}</p>{shipment.courierName?.toLowerCase() === "delhivery" ? <AdminAction url={`/api/shipments/${shipment.id}/track`} label="Refresh live tracking" /> : null}<ol className="mt-5 space-y-3">{shipment.trackingEvents.map((event) => <li key={event.id} className="border-l-2 pl-4 text-sm"><strong>{event.eventType}</strong><p>{event.description}</p><time>{event.eventTime.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</time></li>)}</ol></article>)}</div></main>;
}
