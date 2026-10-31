import { notFound } from "next/navigation";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { SupplierAdminNavigation, supplierAdminMenus } from "@/components/supplier-admin-navigation";
import { SupplierPortalForm } from "@/components/supplier-forms";
import { AdminHeading, AdminNotice, AdminTable, StateBadge } from "@/components/admin-ui";
import { AdminAction } from "@/components/admin-action";
import { inr, adminDate } from "@/lib/admin-format";
import Link from "next/link";
export default async function SupplierManagementPage({ params }: { params: Promise<{ section: string }> }) {
  const user = await requireStoreAdmin(); const { section } = await params; const menu = supplierAdminMenus.find(([, slug]) => slug === section); if (!menu) notFound();
  const suppliers = await prisma.supplier.findMany({ where: section === "direct" ? { sourceType: "DIRECT" } : section === "external" ? { sourceType: "EXTERNAL_SITE" } : {}, include: { _count: { select: { products: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  const url = "/api/admin/suppliers/manage";
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title={menu[0]} description="Manage supplier access, sourcing and fulfilment." /><SupplierAdminNavigation />
    {["direct", "external", "approvals", "performance"].includes(section) ? <><AdminNotice>{section === "external" ? "External-site sourcing records keep purchase websites separate from direct supplier accounts. Add authorized product purchase links under Product Sync mappings. No scraping or automatic purchases are performed." : "Direct suppliers can receive portal access after approval. Disabling a supplier blocks portal access immediately."}</AdminNotice><AdminTable columns={["Supplier", "Source / website", "Products", "Status", "Actions"]} empty="No matching suppliers. Add one under All suppliers.">{suppliers.map((supplier) => <tr key={supplier.id}><td className="font-semibold">{supplier.companyName}<p className="text-xs">{supplier.id}</p></td><td>{supplier.sourceType}<p className="break-all text-xs">{supplier.website || "No website"}</p></td><td>{supplier._count.products}</td><td><StateBadge value={supplier.status} /></td><td><AdminAction url={url} label={supplier.status === "ACTIVE" ? "Disable supplier" : "Approve supplier"} body={{ action: "APPROVE", supplierId: supplier.id, status: supplier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }} confirm="Change this supplier's access status?" /><div className="mt-2"><AdminAction url={url} label={supplier.sourceType === "DIRECT" ? "Move to external-site sourcing" : "Move to direct suppliers"} body={{ action: "SOURCE_TYPE", supplierId: supplier.id, sourceType: supplier.sourceType === "DIRECT" ? "EXTERNAL_SITE" : "DIRECT" }} confirm="Change this supplier type? External-site suppliers cannot access the supplier portal." /></div></td></tr>)}</AdminTable>{section === "external" ? <><Link href="/admin/product-sync" className="mt-5 inline-block underline">View external product mappings</Link><h2 className="mt-6 font-bold">Record a purchase already placed on an external website</h2><SupplierPortalForm url={url} action="EXTERNAL_PURCHASE" fields={[["supplierId", "External supplier ID", "text"], ["sku", "Assigned product SKU", "text"], ["quantity", "Purchased quantity", "number"], ["unitCost", "Unit purchase cost (INR)", "number"], ["purchaseUrl", "Product purchase URL", "url"], ["reference", "External order reference", "text"]]} /><ExternalPurchases /></> : null}{section === "performance" ? <SupplierPerformance /> : null}</> : null}
    {section === "invite" ? <><AdminNotice>Create a direct supplier first, then use its ID below. New suppliers can receive a generated ID and password during registration under All suppliers. This form creates access for an existing direct supplier; it does not send an email.</AdminNotice>{user.role === "ADMIN" ? <SupplierPortalForm url={url} action="INVITE" fields={[["supplierId", "Direct supplier ID", "text"], ["loginId", "Supplier login ID (letters, numbers, dots, hyphens)", "text"], ["fullName", "Contact name", "text"], ["email", "Supplier login email", "email"], ["password", "Initial password (at least 12 characters)", "password"]]} /> : <p>Administrator access is required.</p>}<ul className="mt-5 space-y-3 text-sm">{suppliers.filter((supplier) => supplier.sourceType === "DIRECT").map((supplier) => <li key={supplier.id}>{supplier.companyName} · {supplier.id}</li>)}</ul></> : null}
    {section === "products" ? <><SupplierPortalForm url={url} action="ASSIGN_PRODUCT" fields={[["supplierId", "Supplier ID", "text"], ["sku", "Product SKU", "text"]]} /><SupplierProducts /></> : null}
    {section === "orders" ? <SupplierOrders /> : null}
    {section === "shipments" ? <SupplierShipments /> : null}
    {section === "payments" ? <><AdminNotice>Record completed supplier payments using a bank or gateway reference. This form does not transfer money.</AdminNotice><SupplierPortalForm url={url} action="SETTLEMENT" fields={[["supplierId", "Supplier ID", "text"], ["amount", "Amount paid (INR)", "number"], ["reference", "Bank/payment reference", "text"], ["paidAt", "Payment date", "date"], ["notes", "Notes", "text"]]} /><SupplierPayments /></> : null}
    {section === "support" ? <SupportRequests /> : null}
  </main>;
}
async function SupplierProducts() {
  const products = await prisma.product.findMany({ where: { supplierId: { not: null } }, include: { supplier: true, supplierProducts: { orderBy: { lastUpdatedAt: "desc" }, take: 1 } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AdminTable columns={["Product / SKU", "Supplier", "Supply cost", "Approval"]} empty="No supplier products.">{products.map((product) => <tr key={product.id}><td>{product.name}<p className="text-xs">{product.sku}</p></td><td>{product.supplier?.companyName}</td><td>{inr(product.costPrice)}{product.supplierProducts[0] ? <p className="mt-2 text-xs">Supplier submitted: {inr(product.supplierProducts[0].purchasePrice)}</p> : null}</td><td><StateBadge value={product.status} /><Link href="/admin/products" className="mt-2 block text-xs underline">Review and publish</Link></td></tr>)}</AdminTable>;
}
async function SupplierOrders() {
  const items = await prisma.orderItem.findMany({ where: { supplierId: { not: null } }, include: { customerOrder: true, product: { select: { name: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AdminTable columns={["Order", "Supplier ID", "Item", "Quantity", "Fulfilment"]} empty="No supplier-assigned orders.">{items.map((item) => <tr key={item.id}><td>{item.customerOrder.marketplaceOrderId}</td><td>{item.supplierId}</td><td>{item.product?.name}</td><td>{item.quantity}</td><td><StateBadge value={item.fulfillmentStatus} /></td></tr>)}</AdminTable>;
}
async function SupplierShipments() {
  const shipments = await prisma.shipment.findMany({ where: { supplierId: { not: null } }, include: { customerOrder: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AdminTable columns={["Order", "Supplier ID", "AWB", "Status", "Tracking"]} empty="No supplier shipments.">{shipments.map((entry) => <tr key={entry.id}><td>{entry.customerOrder.marketplaceOrderId}</td><td>{entry.supplierId}</td><td>{entry.trackingNumber}</td><td><StateBadge value={entry.status} /></td><td><AdminAction url={`/api/shipments/${entry.id}/track`} label="Refresh tracking" /></td></tr>)}</AdminTable>;
}
async function SupplierPayments() {
  const payments = await prisma.supplierSettlement.findMany({ orderBy: { paidAt: "desc" }, take: 100 });
  return <AdminTable columns={["Supplier ID", "Amount", "Date", "Reference"]} empty="No recorded settlements.">{payments.map((entry) => <tr key={entry.id}><td>{entry.supplierId}</td><td>{inr(entry.amount)}</td><td>{adminDate(entry.paidAt)}</td><td>{entry.reference}</td></tr>)}</AdminTable>;
}
async function SupplierPerformance() {
  const groups = await prisma.orderItem.groupBy({ by: ["supplierId", "fulfillmentStatus"], where: { supplierId: { not: null } }, _count: true, _sum: { quantity: true } });
  return <div className="mt-6"><AdminTable columns={["Supplier ID", "Fulfilment", "Order lines", "Units"]} empty="No supplier performance data.">{groups.map((entry) => <tr key={`${entry.supplierId}-${entry.fulfillmentStatus}`}><td>{entry.supplierId}</td><td>{entry.fulfillmentStatus}</td><td>{entry._count}</td><td>{entry._sum.quantity}</td></tr>)}</AdminTable></div>;
}
async function SupportRequests() {
  const tickets = await prisma.supportTicket.findMany({ include: { user: { select: { fullName: true, role: true } } }, orderBy: { createdAt: "desc" }, take: 100 });
  return <div className="space-y-4">{!tickets.length ? <p>No support requests.</p> : tickets.map((ticket) => <article key={ticket.id} className="rounded-2xl border bg-white p-5"><h2 className="font-bold">{ticket.subject}</h2><p className="mt-2 text-xs">{ticket.user.fullName} · {ticket.user.role} · {ticket.status}</p><p className="my-4 text-sm">{ticket.message}</p>{ticket.reply ? <p className="text-sm">Reply: {ticket.reply}</p> : null}<SupplierPortalForm url="/api/admin/suppliers/manage" action="SUPPORT_REPLY" hidden={{ ticketId: ticket.id }} fields={[["reply", "Reply", "text"]]} /></article>)}</div>;
}

async function ExternalPurchases() {
  const purchases = await prisma.purchaseOrder.findMany({ where: { supplier: { sourceType: "EXTERNAL_SITE" } }, include: { supplier: { select: { companyName: true } }, items: true }, orderBy: { createdAt: "desc" }, take: 100 });
  return <AdminTable columns={["Purchase", "Website supplier", "Items", "Cost", "Reference details"]} empty="No external-site purchases recorded.">{purchases.map((purchase) => <tr key={purchase.id}><td>{purchase.orderNumber}<p className="text-xs">{adminDate(purchase.createdAt)}</p></td><td>{purchase.supplier.companyName}</td><td>{purchase.items.map((item) => `${item.sku} x ${item.quantity}`).join(", ")}</td><td>{inr(purchase.totalAmount)}</td><td className="max-w-xs break-words text-xs">{purchase.notes}</td></tr>)}</AdminTable>;
}
