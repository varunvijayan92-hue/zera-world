import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supplierAccess, AccessError } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
import { supplierShipmentBill } from "@/lib/shipment-bill";
import { inr, adminDate, contactFromAddress } from "@/lib/admin-format";
import { PrintReceipt } from "@/components/print-receipt";
import { AdminTable } from "@/components/admin-ui";

export const dynamic = "force-dynamic";
export default async function SupplierInvoice({ params }: { params: Promise<{ id: string }> }) {
  const { supplier } = await supplierAccess().catch(error => { if (error instanceof AccessError) redirect("/suppliers/login"); throw error; }); const { id } = await params;
  const order = await prisma.customerOrder.findFirst({ where: { id, orderItems: { some: { supplierId: supplier.id } } }, include: { orderItems: { include: { product: { select: { name: true, sku: true } } } } } });
  if (!order) notFound();
  const items = order.orderItems.filter(item => item.supplierId === supplier.id);
  const bill = supplierShipmentBill(order.orderItems, order.shippingAmount, supplier.id), contact = contactFromAddress(order.shippingAddress);
  return <main className="mx-auto max-w-5xl p-5 text-[#173B35] md:p-8"><Link href="/suppliers/orders" className="text-sm underline print:hidden">Back to supplier orders</Link><div className="my-6 flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl font-black">Shipment bill</h1><p className="break-all text-sm">{order.marketplaceOrderId}</p><p className="text-sm">{supplier.companyName} · {adminDate(order.createdAt)}</p></div><PrintReceipt /></div><section className="mb-5 rounded-xl border p-4"><h2 className="font-bold">Delivery to</h2><p>{contact.fullName || order.customerName}</p><p className="break-words">{contact.address}</p><p>{contact.phone}</p></section><AdminTable columns={["Product", "SKU", "Quantity", "Unit price", "GST (%)"]}>{items.map(item => <tr key={item.id}><td>{item.product?.name || "Product"}</td><td>{item.product?.sku || item.marketplaceSku}</td><td>{item.quantity}</td><td>{inr(item.unitPrice)}</td><td>{Number(item.gstRate || 0)}</td></tr>)}</AdminTable><dl className="ml-auto mt-6 max-w-sm space-y-3 rounded-xl border p-5">{[["Items subtotal", bill.subtotal], ["GST", bill.gst], ["Delivery charge", bill.shipping], ["Handling", bill.handling], ["Shipment total", bill.total]].map(([name, value]) => <div key={String(name)} className="flex justify-between gap-4"><dt>{name}</dt><dd>{inr(value)}</dd></div>)}</dl><p className="mt-4 text-xs">Includes only this supplier&apos;s assigned products and allocated order delivery charge. This fulfilment summary does not confirm payment receipt.</p></main>;
}
