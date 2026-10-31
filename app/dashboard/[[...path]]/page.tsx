import { notFound, redirect } from "next/navigation";

const routes: Record<string, string> = { "": "dashboard", products: "products", categories: "categories", orders: "orders", customers: "customers", inventory: "inventory", suppliers: "suppliers", mappings: "product-sync", marketplaces: "product-sync", reports: "analytics", payments: "payments", settings: "settings", tracking: "tracking", fulfillment: "fulfillment" };
export default async function LegacyDashboardPage({ params }: { params: Promise<{ path?: string[] }> }) {
  const { path } = await params;
  const target = routes[(path || []).join("/")];
  if (!target) notFound();
  redirect(`/admin/${target}`);
}
