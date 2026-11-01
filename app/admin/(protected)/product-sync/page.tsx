import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { adminDate } from "@/lib/admin-format";
import { AdminHeading, AdminNotice, AdminStat, AdminTable, StateBadge } from "@/components/admin-ui";

export default async function ProductSyncPage() {
  await requireStoreAdmin();
  const [jobs, accounts, mappings, supplierMappings] = await Promise.all([
    prisma.syncJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.marketplaceAccount.findMany({ select: { id: true, accountName: true, marketplaceType: true, status: true } }),
    prisma.marketplaceProductMapping.count(),
    prisma.supplierProductMapping.findMany({ include: { product: { select: { name: true, sku: true } }, supplier: { select: { companyName: true } } }, take: 100, orderBy: { updatedAt: "desc" } }),
  ]);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="Product Sync" description="Review saved product mappings, marketplace accounts and synchronization job records." /><AdminNotice>Live supplier and marketplace sync workers are not connected. Stored account statuses below are records, not a live connection check. No sync is started from this page.</AdminNotice><div className="mb-7 grid gap-4 sm:grid-cols-3"><AdminStat label="Marketplace mappings" value={mappings} /><AdminStat label="Recent supplier mappings" value={supplierMappings.length} detail="Latest 100 mappings." /><AdminStat label="Saved marketplace accounts" value={accounts.length} /></div><h2 className="mb-4 text-xl font-bold">Supplier product mappings</h2><AdminTable columns={["Product", "Supplier", "Supplier SKU", "Availability", "Mapping status"]} empty="No supplier mappings are saved.">{supplierMappings.map((entry) => <tr key={entry.id}><td><p className="font-semibold">{entry.product.name}</p><p className="text-xs">{entry.product.sku}</p></td><td>{entry.supplier.companyName}</td><td>{entry.supplierSku || "Not set"}</td><td><StateBadge value={entry.supplierAvailability} /></td><td><StateBadge value={entry.mappingStatus} /></td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Sync jobs</h2><AdminTable columns={["Job", "Status", "Started", "Finished", "Result"]} empty="No sync jobs recorded.">{jobs.map((entry) => <tr key={entry.id}><td>{entry.jobType}</td><td><StateBadge value={entry.status} /></td><td>{adminDate(entry.startedAt)}</td><td>{adminDate(entry.completedAt)}</td><td>{entry.errorMessage || "No error recorded"}</td></tr>)}</AdminTable><h2 className="mb-4 mt-8 text-xl font-bold">Saved accounts</h2><AdminTable columns={["Account", "Marketplace", "Stored status"]} empty="No marketplace account records.">{accounts.map((entry) => <tr key={entry.id}><td>{entry.accountName}</td><td>{entry.marketplaceType}</td><td><StateBadge value={entry.status} /></td></tr>)}</AdminTable></main>;
}
