import Link from "next/link";
export const supplierAdminMenus = [["All suppliers", ""], ["Direct suppliers", "direct"], ["External-site sourcing", "external"], ["CJ API settings", "cj"], ["Local customers", "local-customers"], ["Add / invite supplier", "invite"], ["Supplier approvals", "approvals"], ["Supplier products", "products"], ["Supplier orders", "orders"], ["Supplier shipments", "shipments"], ["Supplier payments", "payments"], ["Supplier performance", "performance"], ["Support requests", "support"]] as const;
export function SupplierAdminNavigation() {
  return <nav aria-label="Supplier management" className="mb-6 flex flex-wrap gap-2">{supplierAdminMenus.map(([name, slug]) => <Link key={name} href={`/admin/suppliers${slug ? `/${slug}` : ""}`} className="rounded-full border bg-white px-4 py-2 text-xs font-semibold">{name}</Link>)}</nav>;
}
