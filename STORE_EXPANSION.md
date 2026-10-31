# Store, customer and supplier update

This change extends the existing Next.js 15 / React 19 / Prisma / PostgreSQL app. It preserves the existing product, order, payment and supplier records. Production database changes and deployment have **not** been executed.

## Working flow after the migration

1. An administrator signs in at `/admin/login`. Categories can receive a Cloudinary image during creation or editing. The image replaces the corresponding homepage category banner. Existing fallback images remain until an image is uploaded.
2. Products have a GST percentage, a handling charge **per unit**, return-window days and a non-returnable checkbox. Existing products default to 5% GST, zero handling and a seven-day return policy. Old order items do not acquire a new return policy retrospectively.
3. Customers register/sign in at `/login`. The account icon opens account links. `/account` contains orders, saved/editable addresses, profile/language preferences, notification preferences, issued vouchers and support questions/replies. Language preferences do not translate the website. Notification preferences do not send emails or SMS. Voucher display does not yet provide checkout redemption or gift-card purchasing.
4. Customers add up to **10 total units** to their cart, edit or remove quantities, then proceed from `/cart` to confirmation. The server enforces this limit and calculates product GST and handling. Delivery remains INR 120 per order. Prices are treated as **exclusive of GST**; obtain the correct product tax rates from your accountant. Handling is displayed separately and does not currently receive an additional GST calculation.
5. At confirmation, customers can choose a saved account address, enter an address, or request a GPS suggestion. Saving while signed in persists the address to the account and browser. Guest address saving remains browser-local. Orders placed as guests are not automatically attached to accounts by email; contact support for guest returns.
6. Razorpay Checkout handles UPI/QR availability. Signature and captured-payment verification remain server-side. Cost prices and supplier purchase prices are excluded from the customer checkout response.
7. New order items retain their product price, supply cost, GST, handling and return policy snapshots. Assign a product supplier before checkout to create supplier-owned order lines. Changes to the catalog do not change the snapshots.
8. Direct suppliers sign in at `/supplier/login`. Their portal has Dashboard, Orders, Products & Inventory, Shipments & Tracking, Returns & RTO, Payments & Settlements, Reports, Notifications, Profile & Settings, Support and Logout. The server restricts every query/action to their active direct supplier account. Verified paid orders progress through accepted, processing, packed and shipped. Supplier-submitted products are drafts pending admin publication. Supplier price submissions are shown for admin review; they do not silently replace the approved catalog supply cost.
9. A supplier enters an already-booked Delhivery AWB. Admins can also record an AWB and actual shipping cost under Tracking. These actions record dispatch, not courier label purchases. Delhivery live tracking uses the store API token and saves provider scan events. Carrier events do not automatically mark delivery confirmed.
10. An administrator confirms delivery under Orders. Only verified paid orders qualify; the timestamp cannot be reset. Eligible signed-in customers can then request a return from their order, specifying quantity and reason. Ownership, order-time return policy, delivery date and cumulative quantities are checked on the server.
11. Admin Returns supports approval/rejection, customer-visible instructions and confirmation that the item was received. Receiving does not automatically restock or refund. After receipt, an admin may explicitly submit an item-price-plus-GST Razorpay refund; shipping and handling are excluded. A confirmation prompt warns that this transfers money. Reconcile pending gateway refunds before retrying. An uncertain request without a gateway ID requires manual gateway investigation.
12. Profit, Loss & Expenses has inclusive India-time date filters and CSV export. It shows paid order value, GST, handling, saved supply costs, shipment costs, expenses, return reasons and processed return-refund records. It is an estimate, excludes unrecorded gateway fees, and reports missing historical supply costs. Return requests are not counted as completed refunds. Each dataset is capped at 10,000 records. Legacy generic refunds and externally issued refunds require reconciliation into the finance records; this is not a complete accounting ledger.

## Direct suppliers and external-site sourcing

`/admin/suppliers` links to All Suppliers, Direct Suppliers, External-site Sourcing, Add / Invite, Approvals, Products, Orders, Shipments, Payments, Performance and Support Requests.

- **Direct suppliers:** create the supplier, approve it, then create a supplier login using a separate supplier email and initial password. No email invitation is sent. Share access privately. Disabling the supplier or moving it to external-site sourcing blocks portal access.
- **External-site suppliers:** use the separate sourcing screen to record a purchase already made, its product URL, external reference, quantity and unit cost. Assign the product to that supplier first. These records do not place orders on external websites.
- Existing suppliers initially default to DIRECT. Use the supplier type action to classify existing external-site sources.
- Supplier settlements record payments already made; they do not transfer funds. Portal balance estimates use limited recent records and require return/payment reconciliation.
- Returns & RTO displays assigned return records and lets suppliers confirm physical receipt. Admins can record an undelivered order item as RTO. Automatic carrier-driven RTO creation and reverse pickup booking are not implemented.

## API settings

- `/admin/settings`: Razorpay key ID, API secret, optional webhook secret; Delhivery API token and pickup-location name.
- `/admin/sellers`: Amazon seller/marketplace IDs, LWA client credentials and authorized refresh token; Flipkart seller/application credentials.
- Only ADMIN can save credentials. MANAGER can view configuration presence. Blank fields preserve existing values. Secrets are encrypted with AES-256-GCM and never returned to the browser. Endpoint URLs are fixed to official providers to prevent sending secrets to an arbitrary entered URL.
- Razorpay uses saved credentials first, then environment credentials. Delhivery uses saved token first, then `DELHIVERY_API_TOKEN`. Saved webhook secret overrides the environment webhook secret.
- Add `INTEGRATION_ENCRYPTION_KEY` to the server environment: a stable, base64-encoded random **32-byte** key. A local key has been generated in the ignored `.env`; configure the same key in Vercel before saving settings. Back it up securely. Changing it makes existing encrypted settings unreadable.
- Saving API settings does not prove account approval or connectivity. Amazon/Flipkart synchronization and supplier auto-purchasing are not implemented. They require approved API access and a configured connector. No live purchase, label booking, payout or refund was executed during this change.
- Last verified Razorpay credentials returned HTTP 401. Add active test credentials before testing payment. QR/app availability is controlled by Razorpay.

Official references: [Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [Delhivery shipment tracking](https://one.delhivery.com/developer-portal/document/b2c/detail/order-tracking), [Amazon authorization](https://developer-docs.amazon/sp-api/lang-us/docs/authorize-public-applications), [Flipkart authentication](https://seller.flipkart.com/api-docs/listing-api-docs/authTut.html).

## Reviewable database update — approval required

`prisma/store-expansion.sql` was generated from a read-only comparison against the configured database. It adds category image columns; product tax/handling/return policy columns; order ownership, delivery and price snapshots; supplier source classification; CUSTOMER role/profile fields; and new address, encrypted setting, settlement, support and voucher tables. It also adds a gateway-refund reference and supporting indexes/foreign keys. There are no DROP TABLE, DROP COLUMN or data-deletion statements.

The attachment explicitly requires approval before production database changes. Do not run the following until approved and after a database backup/restore point is confirmed:

```powershell
npx prisma db execute --schema prisma/schema.prisma --file prisma/store-expansion.sql
npx prisma generate
npm test
npm run build
```

The SQL is a one-time upgrade for the current database, not a replacement for a complete migration baseline on a new empty database. Review a fresh diff if the production schema changes before application. The new version requires the migration; do not deploy it against the old schema. No database records have been modified for this expansion.

## Deployment diagnosis and remaining checks

Read-only checks found `https://zera-world.vercel.app/admin` redirects to `https://zerasworld.in/admin`, which redirects to `/login`. The authenticated deployed dashboard could not be inspected. Local changes have not been pushed or deployed. The remote main branch still tracks `.env`; remove it from the published tree and rotate exposed credentials before publishing. Local `.env` is ignored and untracked.

After migration and an approved deployment, verify Vercel's selected repository/production branch, deployment commit and domain assignment. Set APP_URL/NEXT_PUBLIC_APP_URL to the intended HTTPS domain, server secrets and the encryption key. `/api/health` reports `version: store-portals-v1`, the Vercel commit when supplied, and 503 `migration_pending` if the key new schema is absent.

Verification before production: use two separate suppliers and customers; confirm cross-account data is denied; upload a category image; test 10 versus 11 cart units; verify GST/handling totals; create and capture a Razorpay test payment; pack/record an AWB; refresh Delhivery with a valid account-owned AWB; confirm delivery; request, approve and receive a return; review a test-mode refund and date-filtered CSV. Do not use live refunds as a smoke test.

Validation: 63 automated tests passed. Production build passed with lint and type validation. Mobile Chrome checks passed for separate login pages, anonymous access restrictions, cart cap/editing, saved guest address and checkout navigation with a mocked quote. No real order, payment or database mutation was made by these browser checks.

Automated checks cover pricing, limits, return windows, ownership, role restrictions, credential encryption, CSV safety, delivery prerequisites, duplicate refund blocking and supplier-cost exclusion. Production build includes lint/type validation. End-to-end database-backed tests for the new flows still require the approved migration. Stock reservation/deduction after payment, approved marketplace sync, automated supplier purchases, outbound notification delivery, voucher redemption and full accounting reconciliation remain separate work.

## Files changed in this expansion

New and updated files (earlier staged admin work is retained):

```text
.env.example
DEPLOYMENT.md
STORE_ADMIN_SETUP.md
WORKFLOW.md
app/account/page.tsx
app/admin/customers/page.tsx
app/admin/invoices/[id]/page.tsx
app/admin/login/page.tsx
app/admin/orders/page.tsx
app/admin/products/page.tsx
app/admin/profit-expenses/page.tsx
app/admin/returns/page.tsx
app/admin/sellers/page.tsx
app/admin/settings/page.tsx
app/admin/suppliers/[section]/page.tsx
app/admin/suppliers/page.tsx
app/admin/tracking/page.tsx
app/admin/users/page.tsx
app/api/account/addresses/route.ts
app/api/account/returns/route.ts
app/api/account/route.ts
app/api/account/support/route.ts
app/api/admin/integrations/route.ts
app/api/admin/orders/[id]/delivery/route.ts
app/api/admin/refunds/[id]/reconcile/route.ts
app/api/admin/reports/export/route.ts
app/api/admin/returns/[id]/refund/route.ts
app/api/admin/returns/[id]/route.ts
app/api/admin/returns/route.ts
app/api/admin/shipments/route.ts
app/api/admin/suppliers/manage/route.ts
app/api/auth/login/route.ts
app/api/auth/me/route.ts
app/api/auth/register/route.ts
app/api/categories/[id]/image/route.ts
app/api/health/route.ts
app/api/payments/checkout/route.ts
app/api/payments/refund/route.ts
app/api/payments/webhook/route.ts
app/api/shipments/[id]/track/route.ts
app/api/supplier/actions/route.ts
app/api/verify-payment/route.ts
app/cart/page.tsx
app/checkout/page.tsx
app/layout.tsx
app/login/page.tsx
app/page.tsx
app/products/[id]/page.tsx
app/returns/page.tsx
app/privacy/page.tsx
app/supplier/[section]/page.tsx
app/supplier/login/page.tsx
app/track-order/page.tsx
components/admin-action.tsx
components/admin-record-forms.tsx
components/admin-shell.tsx
components/admin-sign-out.tsx
components/cart-button.tsx
components/category-image-field.tsx
components/category-manager.tsx
components/checkout-summary.tsx
components/customer-account-menu.tsx
components/customer-account.tsx
components/integration-form.tsx
components/portal-login.tsx
components/product-editor.tsx
components/return-review.tsx
components/supplier-admin-navigation.tsx
components/supplier-forms.tsx
components/support-form.tsx
lib/admin-navigation.ts
lib/admin-operations.ts
lib/admin-types.ts
lib/auth.ts
lib/cart.ts
lib/category.ts
lib/checkout-storage.ts
lib/checkout.ts
lib/delhivery.ts
lib/finance-report.ts
lib/integration-crypto.ts
lib/integration-settings.ts
lib/payment.ts
lib/portal-access.ts
lib/rate-limit.ts
lib/razorpay.ts
lib/return-refund.ts
lib/returns.ts
lib/session.ts
lib/supplier-navigation.ts
lib/validators.ts
prisma/schema.prisma
prisma/store-expansion.sql
tests/admin-operations.test.ts
tests/checkout-review.test.ts
tests/checkout.test.ts
tests/payment-flow.test.ts
tests/razorpay-integration.test.ts
tests/store-expansion.test.ts
STORE_EXPANSION.md
```
