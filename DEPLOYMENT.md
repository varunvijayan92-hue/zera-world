> Current status (2026-11-01): The configured database has now been backed up and upgraded, preserving original records. Supplier login IDs and session invalidation are included. See [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) for current deployment status and canonical `/suppliers/login` routes. Earlier pending-migration statements below describe the prior stage.

# ZeraWorld deployment and domain setup

Status: the domain zeraworld.com has not been purchased or verified yet. Do not claim it is connected until the DNS records and live deployment are confirmed in the hosting provider.

## 1. Local development

Use localhost during development until the production domain is purchased and verified.

Environment:

- APP_URL=http://localhost:3000
- NEXT_PUBLIC_APP_URL=http://localhost:3000
- DATABASE_URL=postgresql://... (local or dev database)
- JWT_SECRET=<local secret>
- NEXTAUTH_SECRET=<local secret>
- NODE_ENV=development

This project is configured to keep localhost as the development default so production code does not depend on hardcoded local URLs.

## 2. Production deployment target

Recommended provider: Vercel.

Set these variables in the Vercel project dashboard or equivalent hosting environment once the domain is available:

- APP_URL=https://zeraworld.com
- NEXT_PUBLIC_APP_URL=https://zeraworld.com
- DATABASE_URL=<managed PostgreSQL connection string>
- JWT_SECRET=<strong random secret>
- NEXTAUTH_SECRET=<strong random secret>
- NODE_ENV=production

For PostgreSQL, use a production provider such as Neon, Supabase, Railway, or another managed PostgreSQL service. Keep the database connection string in the host environment, not in the frontend.

## 3. Domain and HTTPS configuration

Once the domain is registered and the hosting provider supports custom domains:

1. Add the domain to Vercel.
2. Complete the domain verification flow in Vercel.
3. Configure the DNS records with the registrar.
4. Confirm the certificate is issued and HTTPS is active.

Do not mark the domain as connected until the verification step is complete.

### DNS record guidance

For the root domain (zeraworld.com):

- A record or ALIAS to the Vercel IPs / Vercel DNS target, depending on the registrar.
- If the registrar supports ALIAS, use that for the apex domain.

For www:

- CNAME to cname.vercel-dns.com

This project is configured for a canonical-domain redirect when APP_URL is set, so www requests can be redirected to the root domain once the live domain is verified.

## 4. Redirect behavior

The app uses a configurable redirect rule driven by APP_URL/NEXT_PUBLIC_APP_URL. It does not assume a live domain until the production URL is set and the domain is verified.

## 5. Secure cookies and production behavior

Production cookies use HTTPS-only settings when the app is running under an HTTPS URL. The app also sets security headers for production deployments to keep the session and application metadata protected.

## 6. Verification checklist before launch

Before claiming the website is live:

- [ ] Domain is purchased and active
- [ ] DNS records are propagated
- [ ] Vercel custom domain is verified
- [ ] HTTPS certificate is issued successfully
- [ ] Database connection works in production
- [ ] App URL and NEXT_PUBLIC_APP_URL match the deployed domain
- [ ] Product browsing, cart and checkout work on the live domain

## 7. Production provider notes

Useful providers:

- Vercel for app hosting
- Neon or Supabase for PostgreSQL
- Cloudflare for DNS when desired

Vercel is the simplest path for this Next.js deployment because it supports custom domains, HTTPS, and environment variables directly.

## Security and checkout update

- Set `JWT_SECRET` to a random value of at least 32 characters. Login fails closed without it.
- The webhook test endpoint has been disabled. Rotate any Razorpay webhook secret that was used while that endpoint was publicly accessible.
- Management pages and APIs require an active ADMIN or MANAGER account. The full admin sidebar opens at `/admin/dashboard` after signing in at `/admin/login`. User and role administration requires ADMIN access.
- Before deploying the expansion, obtain approval and apply the reviewed `prisma/store-expansion.sql` against a backed-up target database. See STORE_EXPANSION.md. Do not deploy the new code against the old schema.
- New checkouts require ACTIVE products, positive prices, matching SKUs, and enough unreserved inventory. Inventory is checked when checkout starts; this version does not reserve stock while a buyer is paying.
- Configure Razorpay to deliver payment.captured, payment.authorized, and payment.failed to `/api/payments/webhook`. Order and payment changes are committed together and checked against the stored amount, currency and gateway order.
- Refund requests are claimed before the gateway call. If a request times out, reconcile it with the gateway before changing its status or retrying.

## Storefront and full admin panel

The storefront supports browsing products, a browser-local cart, guest checkout and verified payment updates. Protected admin pages now include the full requested sidebar alongside product, Cloudinary and category content tools. Legacy `/dashboard` paths redirect into `/admin`. Customer pages contain no admin navigation links.

Products, stock and order records remain in PostgreSQL. Protected management APIs remain available for a future trusted integration; they must not be made public to replace the removed dashboard. Automatic supplier API management is the selected operating model. The supplier and API documentation are still needed before implementing a live connector.

Customer authentication, account order history, returns and supplier portals are implemented in the store expansion. Delhivery tracking requires a valid token. Automated supplier ordering, marketplace synchronization, order/shipment email notifications and stock reservations during payment remain unimplemented. Customer login verification and contact enquiry emails use Resend as described below.

## Razorpay Standard Checkout

See `RAZORPAY_SETUP.md` for create-order and signature verification endpoints, local testing, and capture/webhook setup. The local test credentials are in the ignored `.env`, which has been removed from Git tracking. Configure deployment credentials separately.

## Store content and Cloudinary

See `STORE_ADMIN_SETUP.md` for administrator setup, menu/product editing, Cloudinary environment variables, upload limits and category database setup. Apply the schema and seed categories for a new deployment database before opening the content pages.

## Customer and supplier expansion

Read STORE_EXPANSION.md before deployment. Configure INTEGRATION_ENCRYPTION_KEY in Vercel using the same stable 32-byte base64 key used to encrypt stored settings. New account, supplier, returns, finance export and API settings require this schema. Verify /api/health reports store-portals-v1 and the intended deployment commit. Check the custom domain zerasworld.in after deployment.

## Customer email verification and enquiries

The admin Products form has an Added products list immediately below it. Newly saved products appear in the list; Edit loads the selected item into the form and moves focus to it. Delete asks for confirmation and uses the protected same-origin DELETE product endpoint. Unused products and their dependent stock/catalogue rows can be deleted; products with customer orders, purchase orders, product costs or reserved stock are protected. Archive products with historical records through Edit to remove them from the storefront while preserving history. Deletions are recorded in the audit log. Existing Cloudinary assets are retained rather than risking deletion of an image reused elsewhere.

Product MRP/HSN: apply `prisma/product-mrp-hsn.sql` before deployment. Existing products retain their prices and have blank MRP/HSN values. Admin Products has optional MRP (INR) and HSN code inputs; blank values clear the fields. MRP must be at least the selling price. A higher MRP is crossed out beside the selling price on homepage cards, catalogue/New Arrivals cards and product detail pages. Equal or blank MRP is not presented as a discount. Checkout continues to calculate from the selling price only. HSN is stored as text to preserve leading zeros and shown only when provided. Supplier names and supplier badges are removed from the customer product display; the protected admin supplier assignment and fulfilment relationships remain available.

Search discovery: `/sitemap.xml` is generated dynamically from public storefront/information pages, visible categories with visible parents, and ACTIVE products. Draft/archived products, login, cart, checkout, account, supplier and admin routes are omitted. `/robots.txt` advertises the canonical sitemap and disallows private routes, which also receive production `X-Robots-Tag: noindex, nofollow` headers. Public pages use canonicals on `https://zerasworld.in`; product/category titles and descriptions follow catalogue changes. Homepage structured data identifies Zera's World with alternate names ZerasWorld and Zeras World. Submit `https://zerasworld.in/sitemap.xml` in the owner's Google Search Console and Bing Webmaster Tools accounts. Optional `GOOGLE_SITE_VERIFICATION` and `BING_SITE_VERIFICATION` environment values add the providers' verification meta tags when supplied by the owner; they cannot substitute for ownership verification. Indexing and brand-query placement are controlled by search engines, not guaranteed by this integration.

Support inbox forwarding: Resend receiving is enabled for `zerasworld.in`. Configure the existing `/api/webhooks/resend` webhook to include `email.received`, and store its signing secret in server-only `RESEND_WEBHOOK_SECRET`. Set `RESEND_INBOUND_ADDRESS=support@zerasworld.in`, `RESEND_FORWARD_TO=supportzerasworld@gmail.com`, and `RESEND_FORWARD_FROM=support@zerasworld.in`. Incoming support emails, including website enquiry notifications, are copied to Gmail with the original Reply-To preserved. Signed webhooks, a forwarding marker and a stable send idempotency key prevent forged requests, loops and repeated retry sends. Attachments up to a combined 10 MB are copied; larger attachments remain in Resend with a note in the forwarded message. No existing mail is bulk-forwarded by this setup.

Product editing uses separate Main category and optional Subcategory selectors. A blank subcategory assigns the product to its main category; clearing the main category removes the category assignment. Empty GST, handling and return-day inputs are saved as zero rather than omitted, so clearing an existing value does not silently retain it or apply a default charge. Zero GST/handling rows and blank product description, brand, supplier and category metadata are omitted from the storefront; nonzero checkout charges remain visible. Mobile has its own navigation row, a smaller logo and responsive cart/product layouts. The compact homepage hero spans the full available width.

Category hierarchy: apply `prisma/category-subcategories.sql` before deploying subcategories. Existing categories remain main categories, and existing product assignments and image URLs are preserved. In Categories, use + Subcategory or choose a Parent category. The hierarchy supports a main category and one subcategory level. Parent changes are validated in serializable transactions; categories with children or products cannot be deleted until those records are moved. Category names and slugs remain globally unique. Products can be assigned to either level; parent catalogue filters include products in their subcategories. Hiding a parent hides its children from menus but does not unpublish products or disable direct catalogue URLs. Homepage banners show main categories, while Categories and parent catalogue pages show subcategory images and links. Both levels upload through the existing server-only Cloudinary credentials into `zeraworld/categories/<category-id>`; product uploads remain under `zeraworld/products`.

Administrator account editing is available on the signed-in admin's own row under Users & Roles. Apply the additive `prisma/admin-account-otp.sql` before deploying this feature. Profile updates require the current password and a code delivered to the entered email; password changes require the current password and a code delivered to the saved email. Accounts with legacy non-email identifiers must first verify a valid email through Edit account. Login IDs remain separate from email addresses. Changes apply only to the signed-in ADMIN and never change their role or active status. Codes expire in ten minutes, permit five attempts, and have shared database limits of one send per minute and five per hour. Both profile and password changes revoke all existing sessions. Pending passwords are bcrypt hashes, never plaintext, and pending payloads are erased on successful verification or send failure. Admin account change codes cannot be used for customer sign-in.

Set server-only `RESEND_API_KEY`, `RESEND_FROM_EMAIL` and `SUPPORT_EMAIL` in the local private environment and Vercel Production. Use a sender on a domain verified by Resend. The configured support recipient is `support@zerasworld.in`. Never add the API key to a public environment variable.

Apply the additive `prisma/customer-login-otp.sql` to the target database before deploying this update. It creates one challenge record per customer with a foreign key to the existing User table. No existing account data is changed. The Prisma schema includes the same model for new installations.

Customer registration creates an inactive account, then sends an email code to activate it. Activation and code consumption are atomic; activation codes are marked REGISTER so login codes cannot reactivate disabled accounts. Subsequent customer sign-in uses email and password and returns to the storefront. Codes expire after ten minutes and have five attempts, a one-minute send cooldown and five sends per hour.

Apply `prisma/customer-password-reset.sql` before deploying the recovery flow. `/forgot-password` links from customer login and guides the customer through email, OTP verification, and a new password. `POST /api/auth/password-reset` handles the three steps. It only resets active CUSTOMER accounts and gives the same request response for unknown emails. OTPs are stored as keyed digests; successful verification sets a separate HttpOnly browser proof. Updating the password consumes that proof once and revokes all existing sessions. Admin and supplier accounts use their separate management flows.

Apply `prisma/supplier-gst.sql` for the recent supplier GST fields. This adds three columns and sets the default GST rate for new products to 5, matching the Prisma schema. It does not rewrite existing product tax rates or remove supplier records.

Users & Roles provides Edit account details and Edit password for non-admin users, including suppliers. Supplier contact name/email stays synchronized, and updates revoke previous sessions. ADMIN password and profile edits must use the account owner's OTP form; the general staff endpoint refuses these edits.

The supplied logo and homepage reference are stored under `public/branding`. The logo uses Next.js image delivery. The hero crops the photograph portion of the reference through CSS and renders real headings and shopping links above it; mobile displays the photograph above the text.

Contact submissions remain in the admin inbox and also email the support recipient, with the customer's email as Reply-To. If notification delivery fails, the response explicitly says the enquiry was saved but the email could not be sent. Contact notifications are synchronous and do not have an automatic background retry queue. This integration does not send order or shipment emails.

To test, create a customer account at `/login`, sign in, enter the code received by email, and confirm `/account` opens. A wrong, expired or already-used code must fail. Submit `/contact` and confirm both the admin inbox record and support email arrive. Resend acceptance alone does not establish inbox delivery; check its delivery events when troubleshooting.
# Shiprocket shipping connection

- Open **Admin → Settings → SHIPROCKET**. Create a dedicated API user in Shiprocket Settings → API, then save its email and password here. Credentials use the existing server-side encrypted integration store; no database migration or public environment variables are needed.
- Use **Manage Shiprocket pickup addresses** to open the pickup-address page in Shiprocket. Optionally save the exact registered pickup-location name for reference.
- After saving, click **Check connection & pickup locations** to verify authentication and list pickup-location names. This check does not create shipments or schedule pickups.
- Book the shipment in Shiprocket, then select **Shiprocket** and enter the issued AWB under **Admin → Tracking**, or under the supplier portal's **Shipments & Tracking**. The existing paid-order and supplier-ownership checks still apply.
- Refresh live tracking in the admin, supplier or customer tracking page. Provider scans are saved as tracking events; confirming delivery remains an audited admin action. Automatic booking, label generation and pickup scheduling are not part of this connection.
- API reference: https://apidocs.shiprocket.in/

## Automatic courier tracking webhooks

- In Admin > Settings > SHIPROCKET, an administrator can click **Show webhook setup** to copy the URL and dedicated token. The setup endpoint is administrator-only and uses no-store caching. API passwords are never included.
- In Shiprocket Webhooks, enter URL `https://zerasworld.in/api/webhooks/delivery`, select Auth Token Type `x-api-key`, and paste the dedicated webhook token. Enable the webhook, click **Test Webhook**, then **Save**.
- The webhook token is generated securely in the encrypted SHIPROCKET integration credentials as `webhookToken`. Preserve it when editing API credentials. It must match the value configured in Shiprocket.
- Valid test requests and unmatched AWBs receive HTTP 200. Valid updates match only existing Shiprocket shipments and save tracking events idempotently. Unknown AWBs never create orders or shipments. Delivery confirmation and financial transitions remain admin actions. Invalid authentication is rejected; temporary database failures return a retryable response.

## Supplier pickup locations and AWBs

- Apply `prisma/supplier-pickup-mapping.sql` before deploying the Prisma schema changes. The migration adds nullable fields and preserves existing supplier and shipment data. Regenerate Prisma Client.
- Register each supplier collection address in Shiprocket, using a unique pickup-location name (for example `SUPPLIER_001`). In Admin > Suppliers > Shiprocket pickup, open **Edit pickup mapping**, reload registered locations, select the matching location and save. Only admin/manager roles can edit this mapping; the server verifies the selected name against Shiprocket.
- Under Admin > Tracking, select the order supplier and Shiprocket, then enter the AWB issued when booking the shipment. Suppliers use their own assigned orders and mapping in their portal. An active supplier with a mapping is required for new Shiprocket shipment records.
- The server copies the saved pickup name onto the shipment alongside the AWB. Later mapping edits do not alter that shipment snapshot. Existing shipments without a snapshot remain trackable.
- This associates references in the store. It does not create a pickup address, issue an AWB, validate the AWB's upstream pickup address or move an existing booking. Verify the actual pickup address in Shiprocket when booking. Update both the registered address and the mapping if a supplier moves.
