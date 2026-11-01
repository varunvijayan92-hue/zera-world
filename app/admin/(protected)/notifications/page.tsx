import Link from "next/link";
import { AdminHeading, AdminNotice, AdminStat, AdminTable, StateBadge } from "@/components/admin-ui";
import { adminDate } from "@/lib/admin-format";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

function shippingCity(address: unknown) {
  if (!address || typeof address !== "object" || Array.isArray(address)) return "City not recorded";
  const value = (address as { city?: unknown }).city;
  return typeof value === "string" && value.trim() ? value : "City not recorded";
}

export default async function NotificationsPage() {
  await requireStoreAdmin();

  const [orders, returns] = await Promise.all([
    prisma.customerOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        marketplaceOrderId: true,
        status: true,
        customerName: true,
        createdAt: true,
        shippingAddress: true,
      },
    }),
    prisma.returnRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        status: true,
        reason: true,
        quantity: true,
        createdAt: true,
        customerOrder: { select: { marketplaceOrderId: true, customerName: true } },
      },
    }),
  ]);

  const orderAlerts = orders
    .filter((order) => !["CANCELLED", "DELIVERED", "REFUNDED"].includes(order.status))
    .slice(0, 12)
    .map((order) => ({
      type: "Order",
      title: `${order.marketplaceOrderId} · ${order.status}`,
      detail: `${order.customerName || "Guest customer"} · ${shippingCity(order.shippingAddress)}`,
      time: order.createdAt,
      href: `/admin/orders?order=${order.id}`,
    }));

  const returnAlerts = returns
    .filter((entry) => !["COMPLETED", "REJECTED"].includes(entry.status))
    .slice(0, 12)
    .map((entry) => ({
      type: "Return",
      title: `${entry.customerOrder.marketplaceOrderId} · ${entry.status}`,
      detail: `${entry.customerOrder.customerName || "Guest customer"} · ${entry.reason || "Return request"} · ${entry.quantity} unit(s)`,
      time: entry.createdAt,
      href: "/admin/returns",
    }));

  const alerts = [...orderAlerts, ...returnAlerts].sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 20);
  const newOrderCount = orderAlerts.length;
  const pendingReturnCount = returnAlerts.length;
  const nudgeCount = alerts.filter((alert) => alert.type === "Order").length + alerts.filter((alert) => alert.type === "Return").length;

  return <main className="mx-auto max-w-7xl p-5 md:p-8">
    <AdminHeading title="Notifications" description="A single operational queue for new orders, return requests and follow-up actions requiring attention." />
    <AdminNotice>Only active order and return records are surfaced here. This keeps the notification center grounded in the existing store data without introducing extra schema changes.</AdminNotice>

    <div className="mb-7 grid gap-4 md:grid-cols-3">
      <AdminStat label="New / active orders" value={newOrderCount} detail="Latest non-final order records" href="/admin/orders" />
      <AdminStat label="Pending returns" value={pendingReturnCount} detail="Open return and RTO follow-ups" href="/admin/returns" />
      <AdminStat label="Open alerts" value={nudgeCount} detail="Visible actions needing attention" />
    </div>

    <AdminTable columns={["Type", "Alert", "Details", "Updated", "Open"]} empty="No open notifications. All clear for now.">
      {alerts.map((alert) => (
        <tr key={`${alert.type}-${alert.title}-${alert.time.toISOString()}`}>
          <td><StateBadge value={alert.type} /></td>
          <td className="font-semibold">{alert.title}</td>
          <td className="max-w-md text-[#173B35]/70">{alert.detail}</td>
          <td>{adminDate(alert.time)}</td>
          <td><Link href={alert.href} className="font-semibold text-[#173B35] underline underline-offset-2">Open</Link></td>
        </tr>
      ))}
    </AdminTable>
  </main>;
}
