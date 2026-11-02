import Link from "next/link";
import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate, inr } from "@/lib/admin-format";
import { AdminHeading, AdminTable, StateBadge } from "@/components/admin-ui";
import { StockForm } from "@/components/admin-record-forms";

export default async function InventoryPage() {
  await requireStoreAdmin();
  const inventory = await prisma.inventory.findMany({ include: { product: { select: { name: true, sku: true, hsnCode: true, costPrice: true } }, warehouse: { select: { name: true } } }, orderBy: { updatedAt: "desc" }, take: 100 });
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Inventory" description="Review the latest 100 stock records. Available-to-sell quantity is available stock minus reservations."><Link href="/admin/products" className="rounded-xl border border-[#173B35]/20 bg-white px-4 py-3 text-sm font-semibold">Add product / opening stock</Link></AdminHeading><AdminTable columns={["Product", "Warehouse", "Available", "Reserved", "Sellable", "Safety stock", "Status", "Updated / adjust"]} empty="Add a product with opening stock to create its inventory record.">{inventory.map((row) => <tr key={row.id}><td><p className="font-semibold">{row.product.name}</p><p className="mt-1 text-xs text-[#173B35]/55">{row.product.sku}</p>{row.product.hsnCode ? <p className="mt-1 text-xs">HSN: {row.product.hsnCode}</p> : null}{row.product.costPrice !== null ? <p className="mt-1 text-xs">Cost: {inr(row.product.costPrice)}</p> : null}</td><td>{row.warehouse?.name || "Default"}</td><td>{row.availableQty}</td><td>{row.reservedQty}</td><td><strong className={row.availableQty - row.reservedQty <= row.safetyStock ? "text-amber-800" : ""}>{Math.max(0, row.availableQty - row.reservedQty)}</strong></td><td>{row.safetyStock}</td><td><StateBadge value={row.status} /></td><td><p className="mb-2 text-xs text-[#173B35]/60">{adminDate(row.updatedAt)}</p>{row.status === "AVAILABLE" ? <StockForm stock={{ id: row.id, availableQty: row.availableQty, reservedQty: row.reservedQty, damagedQty: row.damagedQty, safetyStock: row.safetyStock, updatedAt: row.updatedAt.toISOString() }} /> : <p className="text-xs">Warehouse adjustment required</p>}</td></tr>)}</AdminTable></main>;
}
