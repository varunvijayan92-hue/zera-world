// Mobile aliases share the website handlers, validation and role checks.
export const mobileEndpoints = [
  { path: "/api/mobile/admin/inbox", methods: ["GET", "POST"] },
  { path: "/api/mobile/admin/integrations/whatsapp", methods: ["GET"] },
  { path: "/api/mobile/admin/whatsapp/messages", methods: ["POST"] },
  { path: "/api/mobile/admin/whatsapp/notifications", methods: ["GET", "POST"] },
  {
    "path": "/api/mobile/admin/device-token",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/expenses",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/gift-cards",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/integrations",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/returns",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/shipments",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/users",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/users/[id]",
    "methods": [
      "PATCH",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-catalog",
    "methods": [
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-draft",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-freight",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-manual-variant",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-mapping-status",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-mapping-verify",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-mappings",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-order-policy",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-order-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-packaging-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-product-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-stock-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-variant-sync",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/manage",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/[id]/address",
    "methods": [
      "PATCH"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/[id]/cod",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/[id]/credentials",
    "methods": [
      "PATCH"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/[id]/pickup-location",
    "methods": [
      "PATCH"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers/cj-variant-sync/[productId]",
    "methods": [
      "GET",
      "PATCH"
    ]
  },
  {
    "path": "/api/mobile/admin/shipping/pickup-locations",
    "methods": [
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/returns/[id]",
    "methods": [
      "POST",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/returns/[id]/refund",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/reports/export",
    "methods": [
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/refunds/[id]/reconcile",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/products/[id]/stock",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/orders/[id]/cod-collection",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/orders/[id]/delete",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/orders/[id]/delivery",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/inventory/[id]",
    "methods": [
      "PATCH",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/integrations/cj",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/integrations/shiprocket",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/device-token/test-alert",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/accounts/export",
    "methods": [
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/accounts/vouchers",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/account/request-code",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/account/verify",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/categories",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/categories/[id]",
    "methods": [
      "PATCH",
      "DELETE",
      "GET"
    ]
  },
  {
    "path": "/api/mobile/admin/categories/[id]/image",
    "methods": [
      "POST",
      "DELETE"
    ]
  },
  {
    "path": "/api/mobile/admin/categories/reorder",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/suppliers",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/supplier-product-mappings",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "path": "/api/mobile/admin/supplier-approvals",
    "methods": [
      "GET",
      "POST"
    ]
  },
  {
    "path": "/api/mobile/products/[id]/images",
    "methods": [
      "POST",
      "PATCH"
    ]
  },
  {
    "path": "/api/mobile/products/[id]/colour-images",
    "methods": [
      "PUT"
    ]
  },
  {
    "path": "/api/mobile/admin/shipments/[id]/track",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/supplier/actions",
    "methods": [
      "POST"
    ]
  },
  {
    "path": "/api/mobile/supplier/local-customers",
    "methods": [
      "POST",
      "PATCH",
      "GET"
    ]
  }
] as const;
