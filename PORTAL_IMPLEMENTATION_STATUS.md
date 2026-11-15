# Three-portal implementation status

Inspection date: 15 November 2026. Workspace: `E:\wesite`.

One Next.js application and PostgreSQL/Prisma database serve the customer website, admin portal and supplier portal, including Android APIs. Existing Android working-tree changes were preserved. No database migration, seed, payment, refund, bank transfer or deployment was executed in this phase.

“Present” below means the source exists, not that a production workflow has passed acceptance testing. Automated route tests use mocked Prisma/provider calls; they do not establish real database concurrency or integration behaviour.

## Follow-up checkout reliability change

All payment methods now require a client submission reference before stock queries or order creation. Prepaid browser checkout retains the reference across reloads and removes it after confirmed payment. Repeated prepaid requests still return a conflict directing the customer to check existing orders; automatic payment-session recovery remains pending.

Validation: the full 247-test suite initially passed 245 tests; two legacy prepaid fixtures lacked references. After updating those fixtures, all 10 focused payment/reference tests passed. The separate eight-test COD/reference run also passed. This is not evidence of database race safety, completed allocation, or full portal acceptance.

Outstanding acceptance rows also include customer notification preferences, permission-based push, Android/iOS installation guidance, splash experience, low-stock alerts, mobile-app settings and native Android screen/API parity. These must not be inferred complete from the PWA manifests.

## Completed in this phase

- Mapped source routes and models to the requested capabilities below.
- Mobile admin delivery, COD collection and return review now use the existing web handlers, preserving the Android `{ success, message }` response contract. COD receipt updates the existing pending transaction, requires delivery and saves the receipt reference. Return completion requires approval and saves `receivedAt`.
- Mobile user-status changes require ADMIN, protect self/last administrator access and increment the session version. Management transactions use serializable isolation.
- Mobile stock changes reject ambiguous warehouse rows and quantities below existing reservations. Generic order-status changes reject invalid transitions and unpaid fulfilment. Cancellation is rejected pending stock/payment reconciliation.
- Removed the mobile CJ sync response that claimed a job had been queued without creating one. It now returns a clear 409 directing callers to the real integration endpoint.
- Added distinct customer, admin and supplier PWA manifest identities, start URLs and scopes. Portal metadata selects its own manifest. Existing evergreen/cream/gold styling is retained.
- Added a production service worker with a generic offline navigation response. It uses no persistent cache, does not replay mutations and does not intercept API/RSC requests. Private/API response headers and the worker script use `no-store`.
- Added regression tests for COD retries, return receipt transitions, user access/session revocation, stock reservations, PWA identities and offline network behaviour.

## Customer mapping

| Requirement | Existing screens / APIs / models | Assessment and remaining acceptance work |
| --- | --- | --- |
| Catalog and search/filtering | `/products`, `/products/[id]`, `/categories`, `/new-arrivals`; `lib/category.ts`, `lib/public-product.ts` | Present: text/category filtering and newest listing. Browser acceptance and full requested filter set pending. |
| Wishlist | No wishlist route/model found | Pending implementation. |
| Cart | `/cart`, `lib/cart.ts`, cart components | Present; merge/quantity/corrupt storage tests pass. Browser acceptance pending. |
| Checkout, Razorpay, COD | `/checkout`, `/checkout/payment`, `/checkout/success`; `/api/checkout/quote`, `/api/payments/checkout`, `/api/create-order` alias, `/api/verify-payment`, `/api/payments/webhook` | Server pricing, option validation, COD eligibility, payment matching and unique submission key exist. Real provider and database integration tests pending; allocation gap below remains critical. |
| Addresses | Account address tab, `/api/account/addresses`, `/api/address/locate`, `CustomerAddress` | Present; ownership/local storage/geocoding covered in existing tests. Real persistence and browser flows pending. |
| Orders and tracking | `/account`, `/track-order`, `/api/account`, `/api/shipments/[id]/track`; customer tracking components | Present; customer ownership and supplier dispatch grouping tests pass. Live courier acceptance pending. |
| Invoices | Admin print summaries and supplier shipment bill exist | Customer invoice download and immutable numbered tax invoice records pending. |
| Returns | `/account`, `/api/account/returns`; admin return review/refund routes | Present; eligibility/ownership/duplicate refund tests exist. Real receipt/refund/reconciliation pending. |
| Reviews | No customer product review route/model found | Pending implementation and moderation rules. |
| Support | `/contact`, account support tab, `/api/contact`, `/api/account/support`, Resend inbound webhook | Present; validation/forwarding tests pass. Live mail delivery and reply flow pending. |

## Admin mapping

All screen paths below are under `/admin`; protected pages are in `app/admin/(protected)`.

| Requirement | Existing screens / APIs / models | Assessment and remaining acceptance work |
| --- | --- | --- |
| Products/categories | `/products`, `/categories`, `/product-photos`; `/api/products`, `/api/categories`, photo/stock APIs | Present; validation and category hierarchy covered by tests. Browser CRUD and persisted data acceptance pending. |
| Inventory | `/inventory`, `/api/admin/inventory/[id]`, `/api/admin/products/[id]/stock`, `Inventory`, `ProductVariant` | Quantity editing exists. Durable exact-variant allocation, stock consumption/release and concurrency acceptance pending. |
| Orders | `/orders`, `/fulfillment`, delivery/COD/mobile action APIs | Present; basic fulfilment/payment checks exist. Cancellation, allocation and refund orchestration pending. |
| Suppliers/approval | `/suppliers`, `/suppliers/[section]`, `/api/admin/suppliers/manage`, `/api/supplier-approvals`, supplier credential APIs | Present; approved DIRECT supplier ownership checks exist. Full KYC verification flow pending. |
| Purchase orders | `PurchaseOrder`, `PurchaseOrderItem` models | No dedicated complete purchase-order authoring/receipt workflow identified. Pending. |
| Customers | `/customers`, customer queries, account admin APIs | Present; grouping and access tests exist. Browser acceptance pending. |
| Shipping | `/tracking`, `/fulfillment`, `/api/admin/shipments`, courier integration/webhook routes | Present: AWB recording/tracking and pickup mapping. Supplier AWB entry explicitly does not book a label. Live booking/tracking acceptance pending. |
| Payments/settlements | `/payments`, supplier payments section; `PaymentTransaction`, `SupplierSettlement` | Separate records exist; `(supplierId, reference)` is unique in the schema. Settlement recording is manual; no payout execution, line-level entitlement or return/cancellation adjustment ledger. |
| Finance/GST | `/accounts`, `/profit-expenses`, `/accounts/gst`, CSV exports | Internal reports/vouchers exist. GST screen explicitly states official return JSON is unfinished; numbered invoices, credit notes, ITC reconciliation and tax acceptance pending. |
| Refunds | `/returns`, `/api/admin/returns/[id]/refund`, `/api/admin/refunds/[id]/reconcile`, `/api/payments/refund` | Claim/idempotency controls and return refund reconciliation exist. Real gateway tests, generic refund reconciliation and cancellation coordination pending. |
| Marketing/content | Gift cards, product/category content, static information pages | Gift cards exist; campaign/coupon management and general CMS workflows pending. |
| Reports | `/analytics`, `/accounts`, reports/account export APIs | Present; report totals/CSV tests pass. Reconcile complete production data and accounting definitions before acceptance. |
| Staff permissions | `/users`, `/api/admin/users`, `RolePermission` model, role checks | ADMIN/MANAGER gates exist; STAFF is excluded from admin portal. Per-module permission grants are not fully enforced. Pending. |
| Audit logs | `AuditLog` and writes in mutation routes | Partial coverage. Complete mutation audit coverage, audit review screen and retention controls pending. |

## Supplier mapping

Screen paths use `/suppliers/[section]`; `/supplier` routes are legacy entry aliases. `supplierAccess` requires an active DIRECT supplier linked to the signed-in user.

| Requirement | Existing screens / APIs / models | Assessment and remaining acceptance work |
| --- | --- | --- |
| Registration/KYC/approval | Supplier registration/management forms, company profile, credentials, approval APIs | Registration/admin-created accounts and business metadata exist. Public self-service onboarding, private KYC documents and verified approval lifecycle pending. |
| Products/CSV import | `/suppliers/products`, `/api/supplier/actions`, `/api/mobile/supplier/[section]` | Draft product submission and stock/price editing exist. Selecting CSV integration type is not a CSV importer; import/preview/validation pending. |
| Inventory/pricing | Supplier stock action, `lib/supplier-catalog.ts` | Ownership, reservations and price/HSN validation tested. Per-variant inventory and real concurrent writes pending. |
| Assigned orders | `/suppliers/orders`, supplier action API | Queries and mutations scope to supplier ID; transition and ownership tests exist. Browser/database acceptance pending. |
| Packing/dispatch/AWB | `/suppliers/shipments`, ORDER/SHIPMENT actions | Packing transitions, payment checks and existing AWB recording exist. Courier label purchase and real dispatch acceptance pending. |
| Returns | `/suppliers/returns`, RETURN_RECEIVED action | Supplier-scoped receipt timestamp exists; it does not independently authorize refunds. Live return workflow pending. |
| Invoices | `/suppliers/orders/[id]/invoice` | Supplier-scoped shipment summary exists, not a numbered statutory supplier invoice ledger. |
| Earnings | `/suppliers/payments`, `/suppliers/reports`, `SupplierSettlement` | Recent-line estimate and recent settlements only. All-time authoritative balances, returns/cancellations and reconciled payout statements pending. |
| Bank details | No dedicated bank-details workflow/model found | Pending secure storage, masked display, verification and change audit. |
| Support | `/suppliers/support`, supplier SUPPORT_TICKET_CREATE action | Present and user-scoped. Live support acceptance pending. |

## Cross-cutting gaps and next phases

1. **Allocation and cancellation:** checkout reads available stock but never reserves/decrements it. `Inventory` has no variant relation and `OrderItem` has no allocation records. Add explicit variant attributes and allocation records, backfill only unambiguous stock, reserve within the checkout transaction, consume on dispatch, release on cancellation/expiry and reconcile late payments. CJ stock/mapping checks do not replace a durable allocation ledger. Test concurrent checkouts, retry keys and partial returns on isolated PostgreSQL.
2. **Settlements:** define delivered/collected eligibility, return windows, supplier fee/tax policy, COD cash holder and adjustments before generating payable balances. Add immutable supplier ledger entries, payout claims and provider idempotency keys. Existing unique references prevent identical recorded references, not differently referenced duplicate economic payouts. No bank transfers are initiated by current code.
3. **Payments/refunds:** signed raw-body payment webhooks, amount/currency checks and monotonic status transitions exist. End-to-end authorization/capture/failure/retry/refund tests remain. Review ambiguous gateway-create failures and late payment after cancellation. The generic webhook does not process refund events.
4. **Feature completion:** wishlist/reviews, customer invoices, supplier CSV/KYC/bank details, purchase-order workflow, granular staff permissions, marketing/CMS and complete audit coverage.
5. **PWA acceptance:** manifests have independent IDs; HTTPS production device installs, nested-scope behaviour, logout/account switching and offline reload must be tested on supported browsers. The worker handles full document navigations; client-side RSC failures use existing Next.js error handling. It never provides an offline catalog or cached stock. Three installations share the site's session cookie; manifests do not isolate authentication.

## Configuration and deployment

No secret values were printed or changed. `.env.example` lists configuration names; this phase does not certify the validity of existing credentials.

- PostgreSQL `DATABASE_URL`, production `JWT_SECRET` (32+ characters), stable `INTEGRATION_ENCRYPTION_KEY` (base64 32-byte key), matching HTTPS `APP_URL` / `NEXT_PUBLIC_APP_URL` and auth URL configuration.
- Razorpay key ID/secret and independent webhook secret, configured in the existing encrypted integration settings or environment. Register `/api/payments/webhook` for the supported payment events; run test-mode acceptance before live keys. Refund/provider credentials must belong to the same gateway account.
- Shiprocket/Delhivery credentials and webhook token/configuration through existing integration settings; registered supplier pickup locations and verified mappings. CJ credentials and order policy if using CJ.
- Resend API key, verified sender and webhook secret for customer support/OTP mail. Cloudinary configuration for uploads. Android Firebase configuration remains a separate existing setup.
- Supplier payout provider, verified bank details and payout credentials are **not yet implemented**. Business GST identity, invoice numbering, tax policy and supplier settlement terms are required for the pending finance workflows.

For this phase, no schema change is required: run `npm ci`, `npm test`, `npx tsc --noEmit --incremental false`, then `npm run build`; deploy with the existing Next.js hosting workflow and `npm start` (or the existing Vercel project). Do not run seeds or `db:push` against production. Existing SQL scripts are not an ordered Prisma migration history: inventory deployed schema and SQL history on a restored staging database before applying future migrations. Use additive reviewed migrations, explicit backfills, backups and rollback steps. Never run the existing `db:migrate` script blindly against an established database.

After deployment, run `node scripts/check-portal-http.mjs https://YOUR-HOST` to check the three manifest identities, login-page manifest links, cache headers, worker response and unsigned API rejection without creating records. Also verify browser service-worker registration, role/ownership rejection, portal login/logout, provider test webhooks and offline navigation. Deploying this phase does not make the full application production-ready.

## Validation record

- Before changes: all 236 Node tests passed; TypeScript check passed.
- Final full Node suite: **246 passed, zero failures/skips** (236 existing + 10 added tests). The five PWA tests were rerun successfully after the final manifest/worker adjustments.
- Final production `npm run build`: **passed**, including Prisma client generation, compilation, lint/type checking and page generation. Earlier standalone TypeScript checking also passed. One rebuild needed the owned preview server stopped because Windows held the Prisma DLL open; the subsequent build succeeded.
- Production HTTP smoke checks: **passed** for all three manifest identities, admin/supplier login manifest selection, private response cache headers, service worker availability and unauthenticated API rejection. The smoke check caught and prompted correction of root file-based metadata overriding nested portal manifest settings. Explicit manifest routes now preserve per-portal selection.
- `git diff --check` passed for changed backend files. Existing Android whitespace differences were preserved.
- Real PostgreSQL race tests, live integrations, statutory finance validation and device/browser install checks remain untested. No browser automation package was available in the project.
- Android debug build and existing unit test success were reported by the user; Android was not rebuilt in this backend phase.

Implementation references: [Next.js manifests](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest), [MDN service worker fetch handling](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/fetch_event).
