import { mobileEndpoints } from "./mobile-endpoints";

const adminResources: Record<string, string[]> = {
  dashboard: [], analytics: ["reports/export"],
  products: ["products", "suppliers/cj-"], orders: ["orders", "shipments", "shipping/pickup-locations"],
  notifications: ["device-token"], "contact-messages": [], customers: ["users"],
  inventory: ["inventory", "products/[id]/stock"], returns: ["returns", "refunds"],
  sellers: ["integrations"],
  categories: ["categories"], suppliers: ["suppliers", "supplier-product-mappings", "supplier-approvals"],
  fulfillment: ["shipments", "shipping/pickup-locations", "suppliers/cj-draft", "suppliers/cj-order-"],
  "product-sync": ["suppliers/cj-"], tracking: ["shipments", "suppliers/cj-order-sync"],
  accounts: ["accounts", "expenses", "reports/export"], "gift-cards": ["gift-cards"],
  payments: ["orders/[id]/cod-collection", "returns/[id]/refund", "refunds"],
  invoices: ["reports/export"], "profit-expenses": ["expenses", "accounts/vouchers", "reports/export"],
  settings: ["integrations", "account", "device-token"], users: ["users"],
};

const adminActions: Record<string, string[]> = {
  orders: ["ORDER_STATUS", "ORDER_DELIVERY", "COD_COLLECTION"],
  products: ["PRODUCT_STATUS", "PRODUCT_UPDATE", "PHOTO_DELETE", "PHOTO_COVER"],
  support: ["SUPPORT_REPLY"], customers: ["USER_STATUS"],
  inventory: ["INVENTORY_UPDATE"], returns: ["RETURN_REVIEW"],
  suppliers: ["SUPPLIER_CREATE", "SUPPLIER_SETTLEMENT"],
  "profit-expenses": ["EXPENSE_CREATE"], users: ["USER_STATUS"],
};

const supplierActions: Record<string, string[]> = {
  dashboard: [], orders: ["ORDER"], notifications: ["ORDER"],
  products: ["PRODUCT", "STOCK"], shipments: ["SHIPMENT"], returns: ["RETURN_RECEIVED"],
  payments: [], reports: [], "local-customers": ["LOCAL_CUSTOMER_CREATE"], support: ["SUPPORT_TICKET_CREATE"],
  profile: ["PROFILE"], "pickup-address": ["PROFILE"], "company-profile": ["PROFILE"],
};

export function mobileMenuContract(role: "ADMIN" | "SUPPLIER", section: string) {
  const read = { method: "GET", path: `/api/mobile/${role === "ADMIN" ? "admin" : "supplier"}/${section}` };
  const actions = role === "ADMIN" ? adminActions[section] || [] : supplierActions[section] || [];
  const operations: { path: string; methods: readonly string[] }[] = role === "ADMIN"
    ? mobileEndpoints.filter(endpoint => (adminResources[section] || []).some(prefix => endpoint.path.startsWith(`/api/mobile/admin/${prefix}`)))
    : section === "local-customers" ? [{ path: "/api/mobile/supplier/local-customers", methods: ["POST", "PATCH"] }] : [];
  if (role === "ADMIN" && section === "products") {
    operations.push({ path: "/api/mobile/products", methods: ["GET", "POST"] },
      { path: "/api/mobile/products/[id]", methods: ["GET", "PATCH", "DELETE"] },
      { path: "/api/mobile/products/options", methods: ["GET"] },
      { path: "/api/mobile/products/pricing", methods: ["POST"] },
      { path: "/api/mobile/products/exchange-rate", methods: ["GET"] },
      { path: "/api/mobile/products/[id]/photos", methods: ["POST"] });
  }
  if (["products", "categories"].includes(section)) operations.push({ path: "/api/mobile/upload", methods: ["POST"] });
  if (role === "SUPPLIER" && section === "shipments") operations.push({ path: "/api/mobile/admin/shipments/[id]/track", methods: ["POST"] });
  const details = role === "ADMIN"
    ? ["products", "suppliers", "orders", "invoices", "customers", "users", "returns", "inventory", "fulfillment", "tracking", "categories", "payments", "gift-cards", "profit-expenses", "product-sync", "support", "contact-messages"]
    : ["orders", "notifications", "products", "shipments", "returns", "payments", "reports", "local-customers", "support"];
  return { read, ...(details.includes(section) ? { detail: { method: "GET", path: `${read.path}/[id]` } } : {}), operations, ...(actions.length ? { actions: { method: "POST", path: `/api/mobile/${role === "ADMIN" ? "admin" : "supplier"}/actions`, names: actions } } : {}) };
}
