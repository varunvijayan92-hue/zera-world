import Link from "next/link";

import { SupplierApprovalReview } from "@/components/supplier-order-review";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { calculateEstimatedProfit } from "@/lib/profit";

const fallbackOrders = [
  {
    id: "demo-101",
    marketplaceOrderId: "AMZ-10482",
    marketplaceType: "AMAZON",
    status: "PENDING",
    totalAmount: 1899,
    orderItems: [{ id: "1" }, { id: "2" }],
    supplierName: "Northline Goods",
  },
  {
    id: "demo-102",
    marketplaceOrderId: "AMZ-10491",
    marketplaceType: "AMAZON",
    status: "PROCESSING",
    totalAmount: 2430,
    orderItems: [{ id: "1" }, { id: "2" }, { id: "3" }],
    supplierName: "Cedar Supply Co.",
  },
  {
    id: "demo-103",
    marketplaceOrderId: "AMZ-10522",
    marketplaceType: "AMAZON",
    status: "READY_TO_DISPATCH",
    totalAmount: 3299,
    orderItems: [{ id: "1" }, { id: "2" }],
    supplierName: "PrimeNest Traders",
  },
];

export default async function OrdersPage() {
  await requireAuth();

  const orders = await prisma.customerOrder.findMany({
    include: { orderItems: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const visibleOrders = (orders.length ? orders : fallbackOrders) as Array<{
    id: string;
    marketplaceOrderId: string;
    marketplaceType: string;
    status: string;
    totalAmount: number;
    orderItems: Array<{ id: string }>;
    supplierName?: string;
  }>;

  const stats = [
    { label: "Amazon orders", value: visibleOrders.length.toString(), detail: "Incoming marketplace orders" },
    { label: "Pending dispatch", value: visibleOrders.filter((order) => String(order.status).toUpperCase() === "PENDING").length.toString(), detail: "Awaiting supplier action" },
    { label: "In process", value: visibleOrders.filter((order) => String(order.status).toUpperCase() === "PROCESSING").length.toString(), detail: "Supplier fulfillment" },
    { label: "Net margin", value: "₹4.82L", detail: "Estimated after costs" },
  ];

  const approvalQueue = visibleOrders.map((order) => ({
    id: String(order.id),
    marketplaceOrderId: String(order.marketplaceOrderId || order.id),
    marketplaceType: String(order.marketplaceType || "AMAZON"),
    supplierName: typeof order.supplierName === "string" ? order.supplierName : undefined,
    totalAmount: Number(order.totalAmount || 0),
    status: String(order.status || "PENDING"),
    itemCount: Array.isArray(order.orderItems) ? order.orderItems.length : 0,
    customerName: "Marketplace buyer",
  }));

  return (
    <section className="rounded-[30px] border border-[#173B35]/10 bg-white p-6 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-[#173B35]/60">Order management</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em] text-[#173B35]">Amazon to supplier workflow</h1>
        </div>
        <Link
          href="/dashboard/orders"
          className="inline-flex rounded-xl bg-[#173B35] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f2a26]"
        >
          Import marketplace orders
        </Link>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4">
            <p className="text-sm text-[#173B35]/60">{stat.label}</p>
            <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-[#173B35]">{stat.value}</p>
            <p className="mt-2 text-xs text-[#173B35]/60">{stat.detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleOrders.map((order) => {
          const orderStatus = String(order.status || "PENDING").toUpperCase();
          const quantity = Array.isArray(order.orderItems) ? order.orderItems.length : 0;
          const sellingPrice = Number(order.totalAmount || 0);
          const totals = calculateEstimatedProfit({
            sellingPrice,
            supplierCost: 450,
            marketplaceFeeRate: 8.5,
            shippingCost: 120,
            packagingCost: 35,
            taxRate: 5,
          });

          const statusClasses =
            orderStatus === "PENDING"
              ? "bg-[#F7F4ED] text-[#173B35]"
              : orderStatus === "PROCESSING"
                ? "bg-[#8EA695]/15 text-[#173B35]"
                : "bg-[#B38A45]/15 text-[#173B35]";

          return (
            <div key={order.id} className="rounded-[26px] border border-[#173B35]/10 bg-[#F7F4ED] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#173B35]/60">{order.marketplaceType}</p>
                  <p className="mt-2 text-lg font-black text-[#173B35]">{order.marketplaceOrderId}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${statusClasses}`}>
                  {orderStatus}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm text-[#173B35]/70">
                <p><span className="font-semibold text-[#173B35]">Customer:</span> {order.id ? "Marketplace buyer" : "Demo buyer"}</p>
                <p><span className="font-semibold text-[#173B35]">Supplier:</span> {order.supplierName || "Awaiting assignment"}</p>
                <p><span className="font-semibold text-[#173B35]">Items:</span> {quantity}</p>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-[#173B35]/60">Order value</p>
                  <p className="mt-2 text-2xl font-black text-[#173B35]">₹{sellingPrice.toFixed(2)}</p>
                </div>
                <p className="text-sm font-semibold text-[#173B35]">Est. profit ₹{totals.netProfit.toFixed(2)}</p>
              </div>

              <div className="mt-5 flex gap-2">
                <Link
                  href="/dashboard/suppliers"
                  className="flex-1 rounded-xl border border-[#173B35]/15 bg-white px-3 py-2 text-center text-sm font-semibold text-[#173B35]"
                >
                  Assign supplier
                </Link>
                <Link
                  href="/dashboard/inventory"
                  className="flex-1 rounded-xl bg-[#173B35] px-3 py-2 text-center text-sm font-semibold text-white"
                >
                  Send to supplier
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      <SupplierApprovalReview items={approvalQueue} />
    </section>
  );
}
