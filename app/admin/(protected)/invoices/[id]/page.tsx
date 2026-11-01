import { notFound } from "next/navigation";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr, contactFromAddress } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";
import { PrintReceipt } from "@/components/print-receipt";

export default async function OrderReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStoreAdmin();
  const { id } = await params;
  const order = await prisma.customerOrder.findUnique({ where: { id }, include: { orderItems: { include: { product: { select: { name: true } } } } } });
  if (!order) notFound();
  const payment = await prisma.paymentTransaction.findFirst({ where: { orderId: id }, orderBy: { createdAt: "desc" }, select: { paymentStatus: true } });
  const contact = contactFromAddress(order.shippingAddress);
  const subtotal = Number(order.subtotal ?? order.orderItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * item.quantity, 0));
  const shipping = Number(order.shippingAmount || 0);
  const total = Number(order.totalAmount || 0);
  return <main className="mx-auto max-w-5xl p-5 md:p-8"><AdminHeading title="Order receipt" description={order.marketplaceOrderId}><PrintReceipt /></AdminHeading><AdminNotice>This is an order summary, not a separately numbered tax invoice.</AdminNotice><section className="mb-6 grid gap-5 rounded-2xl border bg-white p-6 sm:grid-cols-2"><div><h2 className="font-bold">ZeraWorld</h2><p className="mt-2 text-sm">Order date: {adminDate(order.createdAt)}</p><p className="mt-2 text-sm">Payment: <StateBadge value={payment?.paymentStatus || "NOT_RECORDED"} /></p></div><div><h2 className="font-bold">Delivery to</h2><p className="mt-2 text-sm">{contact.fullName || order.customerName || "Guest"}</p><p className="mt-1 text-sm leading-relaxed">{contact.address || "Address not recorded"}</p><p className="mt-1 text-sm">{contact.email || contact.phone}</p></div></section><AdminTable columns={["Item", "Quantity", "Unit price", "Line total"]}>{order.orderItems.map((item) => <tr key={item.id}><td>{item.product?.name || item.marketplaceSku || "Item"}</td><td>{item.quantity}</td><td>{inr(item.unitPrice)}</td><td>{inr(Number(item.unitPrice || 0) * item.quantity)}</td></tr>)}</AdminTable><dl className="ml-auto mt-6 max-w-sm space-y-3 rounded-2xl border bg-white p-6 text-sm"><div className="flex justify-between"><dt>Subtotal</dt><dd>{inr(subtotal)}</dd></div><div className="flex justify-between"><dt>Delivery</dt><dd>{inr(shipping)}</dd></div><div className="flex justify-between"><dt>GST</dt><dd>{inr(order.taxAmount ?? Math.max(0, total - subtotal - shipping))}</dd></div><div className="flex justify-between"><dt>Handling</dt><dd>{inr(order.handlingAmount)}</dd></div><div className="flex justify-between border-t pt-3 text-lg font-bold"><dt>Order total</dt><dd>{inr(total)}</dd></div></dl></main>;
}
