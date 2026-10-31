export const adminNavigation = [
  { label: "Overview", items: [
    { label: "Dashboard", href: "/admin/dashboard", icon: "dashboard" },
    { label: "Analytics", href: "/admin/analytics", icon: "analytics" },
  ] },
  { label: "Commerce", items: [
    { label: "Products", href: "/admin/products", icon: "products" },
    { label: "Orders", href: "/admin/orders", icon: "orders" },
    { label: "Customers", href: "/admin/customers", icon: "customers" },
    { label: "Inventory", href: "/admin/inventory", icon: "inventory" },
    { label: "Categories", href: "/admin/categories", icon: "categories" },
  ] },
  { label: "Dropshipping", items: [
    { label: "Suppliers", href: "/admin/suppliers", icon: "suppliers" },
    { label: "Fulfillment", href: "/admin/fulfillment", icon: "fulfillment" },
    { label: "Product Sync", href: "/admin/product-sync", icon: "sync" },
    { label: "Tracking", href: "/admin/tracking", icon: "tracking" },
  ] },
  { label: "Finance", items: [
    { label: "Payments", href: "/admin/payments", icon: "payments" },
    { label: "Invoices", href: "/admin/invoices", icon: "invoices" },
    { label: "Profit & Expenses", href: "/admin/profit-expenses", icon: "profit" },
  ] },
  { label: "System", items: [
    { label: "Settings", href: "/admin/settings", icon: "settings" },
    { label: "Users & Roles", href: "/admin/users", icon: "users" },
  ] },
] as const;

export function isAdminNavActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
