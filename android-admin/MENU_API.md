# Android menu API

Log in through `POST /api/auth/login` with `{"portal":"APP","loginId":"your-login","password":"your-password"}`. Keep the `supplierbridge_session` cookie for subsequent requests. Use HTTPS with the included Android client. `POST /api/auth/logout` ends the session. A native request may omit Origin; requests with an Origin must match the API origin where checked.

Fetch `GET /api/mobile/navigation`. Each existing menu keeps its `id` and `label` and now includes `api`:

```json
{
  "id": "orders",
  "label": "Orders",
  "api": {
    "read": {"method": "GET", "path": "/api/mobile/admin/orders"},
    "detail": {"method": "GET", "path": "/api/mobile/admin/orders/[id]"},
    "operations": [],
    "actions": {
      "method": "POST",
      "path": "/api/mobile/admin/actions",
      "names": ["ORDER_STATUS", "ORDER_DELIVERY", "COD_COLLECTION"]
    }
  }
}
```

The abbreviated `operations` above is populated by the server with the applicable workflow routes and supported HTTP methods. Replace bracketed parameters such as `[id]` and `[productId]` with URL-encoded record IDs. An advertised operation is discoverable, not a grant of permission: ADMIN-only handlers still reject managers, and suppliers can only access their assigned records. Passwords and integration credential values are excluded from menu reads.

## Reading menus

All 22 admin menus use `GET /api/mobile/admin/{menuId}`:

`dashboard`, `analytics`, `products`, `orders`, `notifications`, `contact-messages`, `customers`, `inventory`, `returns`, `sellers`, `categories`, `suppliers`, `fulfillment`, `product-sync`, `tracking`, `accounts`, `gift-cards`, `payments`, `invoices`, `profit-expenses`, `settings`, `users`.

All 13 supplier menus use `GET /api/mobile/supplier/{menuId}`:

`dashboard`, `orders`, `products`, `local-customers`, `shipments`, `returns`, `payments`, `reports`, `notifications`, `profile`, `pickup-address`, `company-profile`, `support`.

Menu lists accept `?page=1&limit=100`; page starts at 1 and limit is 1–200. List responses preserve `data` and add `meta: {page, limit, hasMore}`. A full page indicates there may be more records; request the next page until a shorter page is returned. Report objects with lists use `meta.collections`, for example `meta.collections.transactions.hasMore`. Dashboard/profile objects do not need pagination. Accounts and profit-expenses accept `from` and `to` as `YYYY-MM-DD`, interpreted in India time, up to 366 days; their financial summary follows the selected period while list pagination is separate.

When navigation includes `api.detail`, use it to open a record. Supplier order IDs are order-item IDs, not parent customer-order IDs. Supplier product details expose cost and stock, not admin selling-price controls. Invoice details return the order, tax amounts, line items and shipments as JSON. Export routes return CSV; retain their Content-Type and download headers.

Contact requests read website contact submissions. They are distinct from support tickets; the website has no configured email-reply workflow for these submissions. `GET /api/mobile/admin/support` and its detail endpoint provide support tickets; use `SUPPORT_REPLY` for an in-app ticket reply. Seller channels report Amazon/Flipkart credential configuration and explicitly report `connectorEnabled: false`; saving credentials does not enable a marketplace connector.

## Writing data

Use the resource routes below for full website-equivalent operations. They call the website handlers directly, retaining validation, audit, payment checks and role restrictions. Payloads are identical to the corresponding website APIs. Existing `/api/mobile/admin/actions` remains compatible with the older Android forms. Supplier actions are also available at `/api/mobile/supplier/actions`.

Examples (JSON unless described otherwise):

| Operation | Method and path | Payload |
| --- | --- | --- |
| Publish/archive product | PATCH `/api/mobile/products/[id]` | `{"status":"ACTIVE","sellingPrice":499}` |
| Create/update product | POST `/api/mobile/products` or PATCH `/api/mobile/products/[id]` | See [product API](PRODUCT_API.md) |
| Create category | POST `/api/mobile/admin/categories` | `{"name":"Home","slug":"home","description":"Home products"}` |
| Update category | PATCH `/api/mobile/admin/categories/[id]` | Changed category fields, including parentId/isVisible/sortOrder |
| Delete category | DELETE `/api/mobile/admin/categories/[id]` | No body; move children/products first |
| Category image | POST `/api/mobile/admin/categories/[id]/image` | Multipart field `image` |
| Create supplier | POST `/api/mobile/admin/suppliers` | `{"companyName":"Supplier Co","sourceType":"DIRECT"}` plus optional supplier fields |
| Approve supplier | POST `/api/mobile/admin/suppliers/manage` | `{"action":"APPROVE","supplierId":"id","status":"ACTIVE"}` |
| Supplier settlement | POST `/api/mobile/admin/suppliers/manage` | `{"action":"SETTLEMENT","supplierId":"id","amount":1000,"reference":"BANK-123","notes":"","paidAt":"2026-11-15"}` |
| Record shipment | POST `/api/mobile/admin/shipments` | `{"orderId":"id","courierName":"Delhivery","awb":"AWB12345","shipmentCost":60}`; optional supplierId |
| Refresh tracking | POST `/api/mobile/admin/shipments/[id]/track` | `{}`; supports assigned suppliers as well as management |
| Order delivery | POST `/api/mobile/admin/orders/[id]/delivery` | `{}` |
| Collect delivered COD | POST `/api/mobile/admin/orders/[id]/cod-collection` | `{"reference":"RECEIPT-123"}` |
| Review return | POST `/api/mobile/admin/returns/[id]` | `{"action":"APPROVED","notes":"Approved after review"}`; also REJECTED or RECEIVED |
| Refund return | POST `/api/mobile/admin/returns/[id]/refund` | `{}`; existing refund/payment safeguards apply |
| Create expense | POST `/api/mobile/admin/expenses` | `{"category":"Packaging","description":"Boxes","amount":250,"expenseDate":"2026-11-15T06:30:00.000Z"}` |
| Issue gift card | POST `/api/mobile/admin/gift-cards` | `{"customerEmail":"customer@example.com","code":"GIFT-123","amount":500,"expiresOn":""}`; ADMIN only |
| Create user | POST `/api/mobile/admin/users` | `{"fullName":"Staff Name","email":"staff@example.com","password":"a-long-private-password","role":"STAFF"}`; ADMIN only |
| User access | PATCH `/api/mobile/admin/users/[id]` | `{"role":"STAFF","isActive":true}`; ADMIN only |
| Save integration | POST `/api/mobile/admin/integrations` | `{"provider":"RAZORPAY","credentials":{"keyId":"...","keySecret":"..."}}`; ADMIN only |
| Advance order | POST `/api/mobile/admin/actions` | `{"action":"ORDER_STATUS","orderId":"id","status":"PROCESSING"}`; only valid paid/COD transitions |
| Reply to support | POST `/api/mobile/admin/actions` | `{"action":"SUPPORT_REPLY","ticketId":"id","reply":"Reply text","status":"RESOLVED"}` |
| Supplier order action | POST `/api/mobile/supplier/actions` | `{"action":"ORDER","itemId":"id","status":"ACCEPTED"}`; valid sequence ACCEPTED → PROCESSING → PACKED |
| Supplier dispatch | POST `/api/mobile/supplier/actions` | `{"action":"SHIPMENT","itemId":"id","courierName":"Delhivery","awb":"AWB12345"}` |
| Supplier product draft | POST `/api/mobile/supplier/actions` | `{"action":"PRODUCT","name":"Product","sku":"SKU-1","description":"Details","costPrice":100,"stock":5}`; returns `data.id` for photo uploads |
| Supplier stock/cost | POST `/api/mobile/supplier/actions` | `{"action":"STOCK","productId":"id","stock":5,"costPrice":100}`; optional hsnCode |
| Supplier return receipt | POST `/api/mobile/supplier/actions` | `{"action":"RETURN_RECEIVED","returnId":"id"}` |
| Supplier profile/address | POST `/api/mobile/supplier/actions` | `{"action":"PROFILE","pickupAddressLine1":"Street","pickupCity":"Kochi","pickupState":"Kerala","pickupPincode":"682001"}`; company/contact/GST fields supported |
| Supplier support | POST `/api/mobile/supplier/actions` | `{"action":"SUPPORT_TICKET_CREATE","subject":"Order question","message":"Please review this order"}` |
| Local customer | POST `/api/mobile/supplier/local-customers` | `{"name":"Customer","phone":"9999999999","email":"","address":"","notes":""}`; PATCH also requires id |

Photo upload remains multipart. `POST /api/mobile/upload` accepts `file`, plus exactly the intended `productId` or `categoryId` and `kind` (`products`/`categories`). Supplier uploads require product ownership. The product batch endpoint uses repeated `files` fields instead; see [product API](PRODUCT_API.md).

Errors return an HTTP failure status and `message`. Reauthenticate on 401; show access denial on 403; refresh stale state on 409. Do not blindly retry payment, settlement, expense or creation requests after network timeouts; verify the existing record first. Mutations can have different success envelopes (`data`, `message`, or workflow-specific fields), preserved from the website.

## Android repository

`NavItem.api` retains the discovered contract. `fetchAdminSection(section, page, limit)` and `fetchSupplierSection(section, page, limit)` load pages. `requestMobileApi(path, method, payload)` calls discovered JSON/detail/export endpoints with the existing cookie jar. `uploadPhoto` handles device image bytes. JSON examples:

```kotlin
repository.fetchAdminSection("orders", page = 2, limit = 25)
repository.requestMobileApi("/api/mobile/admin/orders/order-id", "GET")
repository.requestMobileApi(
    "/api/mobile/supplier/actions", "POST",
    JSONObject().put("action", "ORDER").put("itemId", "item-id").put("status", "ACCEPTED")
)
```

Menu rendering and individual form screens still need to consume the returned fields. These changes do not deploy the server or install/test an Android build on a device.

## Mobile workflow route inventory

Paths below expose the same payloads and safeguards as their original website handlers. Menu reads and generic record-detail routes described above are additional to this inventory.

| Path | Methods |
| --- | --- |
| `/api/mobile/admin/device-token` | POST, GET |
| `/api/mobile/admin/expenses` | POST |
| `/api/mobile/admin/gift-cards` | POST, GET |
| `/api/mobile/admin/integrations` | POST |
| `/api/mobile/admin/returns` | POST, GET |
| `/api/mobile/admin/shipments` | POST |
| `/api/mobile/admin/users` | POST, GET |
| `/api/mobile/admin/users/[id]` | PATCH, GET |
| `/api/mobile/admin/suppliers/cj-catalog` | GET |
| `/api/mobile/admin/suppliers/cj-draft` | POST |
| `/api/mobile/admin/suppliers/cj-freight` | POST |
| `/api/mobile/admin/suppliers/cj-manual-variant` | POST |
| `/api/mobile/admin/suppliers/cj-mapping-status` | POST |
| `/api/mobile/admin/suppliers/cj-mapping-verify` | POST |
| `/api/mobile/admin/suppliers/cj-mappings` | POST |
| `/api/mobile/admin/suppliers/cj-order-policy` | POST |
| `/api/mobile/admin/suppliers/cj-order-sync` | POST |
| `/api/mobile/admin/suppliers/cj-packaging-sync` | POST |
| `/api/mobile/admin/suppliers/cj-product-sync` | POST |
| `/api/mobile/admin/suppliers/cj-stock-sync` | POST |
| `/api/mobile/admin/suppliers/cj-variant-sync` | POST |
| `/api/mobile/admin/suppliers/manage` | POST |
| `/api/mobile/admin/suppliers/[id]/address` | PATCH |
| `/api/mobile/admin/suppliers/[id]/cod` | POST |
| `/api/mobile/admin/suppliers/[id]/credentials` | PATCH |
| `/api/mobile/admin/suppliers/[id]/pickup-location` | PATCH |
| `/api/mobile/admin/suppliers/cj-variant-sync/[productId]` | GET, PATCH |
| `/api/mobile/admin/shipping/pickup-locations` | GET |
| `/api/mobile/admin/returns/[id]` | POST, GET |
| `/api/mobile/admin/returns/[id]/refund` | POST |
| `/api/mobile/admin/reports/export` | GET |
| `/api/mobile/admin/refunds/[id]/reconcile` | POST |
| `/api/mobile/admin/products/[id]/stock` | POST |
| `/api/mobile/admin/orders/[id]/cod-collection` | POST |
| `/api/mobile/admin/orders/[id]/delete` | POST |
| `/api/mobile/admin/orders/[id]/delivery` | POST |
| `/api/mobile/admin/inventory/[id]` | PATCH, GET |
| `/api/mobile/admin/integrations/cj` | POST |
| `/api/mobile/admin/integrations/shiprocket` | POST |
| `/api/mobile/admin/device-token/test-alert` | POST |
| `/api/mobile/admin/accounts/export` | GET |
| `/api/mobile/admin/accounts/vouchers` | POST |
| `/api/mobile/admin/account/request-code` | POST |
| `/api/mobile/admin/account/verify` | POST |
| `/api/mobile/admin/categories` | GET, POST |
| `/api/mobile/admin/categories/[id]` | PATCH, DELETE, GET |
| `/api/mobile/admin/categories/[id]/image` | POST, DELETE |
| `/api/mobile/admin/categories/reorder` | POST |
| `/api/mobile/admin/suppliers` | GET, POST |
| `/api/mobile/admin/supplier-product-mappings` | GET, POST |
| `/api/mobile/admin/supplier-approvals` | GET, POST |
| `/api/mobile/products/[id]/images` | POST, PATCH |
| `/api/mobile/products/[id]/colour-images` | PUT |
| `/api/mobile/admin/shipments/[id]/track` | POST |
| `/api/mobile/supplier/actions` | POST |
| `/api/mobile/supplier/local-customers` | POST, PATCH, GET |
