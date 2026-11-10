import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { CjIntegrationForm } from "@/components/cj-integration-form";
import { SupplierAdminNavigation } from "@/components/supplier-admin-navigation";
import { AdminAction } from "@/components/admin-action";
import { AdminHeading } from "@/components/admin-ui";
import { AdminNotice, AdminTable } from "@/components/admin-ui";
import { CjProductMappingForm } from "@/components/cj-product-mapping-form";
import { CjCatalogSearch } from "@/components/cj-catalog-search";
import { CjShippingQuote } from "@/components/cj-shipping-quote";
import { CjOrderPolicyForm } from "@/components/cj-order-policy-form";
import { cjOrderPolicySchema } from "@/lib/cj-order-policy";

export default async function CjSupplierPage() {
  const user = await requireStoreAdmin();
  const [saved, products, suppliers, mappings] = await Promise.all([
    prisma.integrationSetting.findUnique({ where: { provider: "CJ_DROPSHIPPING" }, select: { id: true, options: true } }),
    prisma.product.findMany({ select: { id: true, name: true, sku: true, supplierId: true }, orderBy: { name: "asc" }, take: 500 }),
    prisma.supplier.findMany({ where: { sourceType: "EXTERNAL_SITE", status: "ACTIVE", provider: "CJ_DROPSHIPPING" }, select: { id: true, companyName: true }, orderBy: { companyName: "asc" }, take: 500 }),
    prisma.supplierProductMapping.findMany({ where: { supplier: { provider: "CJ_DROPSHIPPING" } }, include: { product: { select: { name: true, sku: true } }, supplier: { select: { companyName: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
  ]);
  const options = saved?.options && typeof saved.options === "object" && !Array.isArray(saved.options) ? saved.options : {};
  const policy = cjOrderPolicySchema.safeParse(options.orderPolicy);
  return <main className="mx-auto max-w-7xl p-5 md:p-8"><AdminHeading title="CJ API settings" description="Manage the store's CJdropshipping connection." /><SupplierAdminNavigation /><div className="max-w-3xl"><CjIntegrationForm saved={!!saved} canEdit={user.role === "ADMIN"} /><CjOrderPolicyForm origin={policy.success ? policy.data.origin : ""} trackedMethods={policy.success ? policy.data.trackedMethods : []} canEdit={user.role === "ADMIN"} /><CjCatalogSearch /><CjShippingQuote /><CjProductMappingForm products={products} suppliers={suppliers} /></div><div className="mt-6"><AdminNotice>Verify product mappings against CJ to move matching pending entries to Active. This checks IDs and SKUs only; it does not check stock, prices or delivery, and automatic ordering remains unavailable.</AdminNotice><AdminTable columns={["Product", "Supplier", "CJ product ID", "CJ variant ID", "Status", "Verification"]} empty="No external supplier mappings saved.">{mappings.map((mapping, index) => <tr key={mapping.id}><td>{mapping.product.name} ({mapping.product.sku})</td><td>{mapping.supplier.companyName}</td><td className="break-all">{mapping.externalProductId || "Not recorded"}</td><td className="break-all">{mapping.supplierVariantId || "Not recorded"}</td><td>{mapping.mappingStatus || "PENDING"}</td><td>{mapping.mappingStatus === "PENDING" && mapping.externalProductId && mappings.findIndex(entry => entry.productId === mapping.productId && entry.externalProductId === mapping.externalProductId && entry.mappingStatus === "PENDING") === index ? <AdminAction url="/api/admin/suppliers/cj-mapping-verify" label="Verify product mappings" body={{ productId: mapping.productId, externalProductId: mapping.externalProductId }} /> : null}</td></tr>)}</AdminTable></div></main>;
}
