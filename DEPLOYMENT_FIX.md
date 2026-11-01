# Local / Vercel parity repair

## Confirmed causes

1. GitHub's Vercel check for commit `482b3f9` failed. The supplied build log identified an internal `<a>` link in `app/admin/suppliers/page.tsx`. It is now a Next.js `Link`. A failed deployment leaves the previous successful production version in place; this explains the old dashboard in the live screenshot.
2. The configured PostgreSQL database was reachable but lacked the expansion columns, including supplier source type and product GST/handling fields. This caused the new local admin data-loading error.
3. Supplier login ID/session-version code was present, but its database update and verification were unfinished.
4. The full shipment test exposed Prisma's five-second transaction timeout on the remote database. The shared client now allows 30 seconds for multi-record transactions, and conflict responses ask the operator to refresh rather than reporting an unexplained server error. Error logs record safe codes without query arguments or customer data.

## Completed database work

The original schema and all data were backed up to the ignored local `.backups/2026-11-01T03-04-32-552Z/` directory. It contains schema SQL, data JSON, dependency-ordered data SQL, a manifest and a SHA-256 integrity check. Do not publish this directory.

The reviewed additive `prisma/store-expansion.sql` update was applied to the database configured in the local `.env`. The original 30 tables / 8 rows were checked afterwards: original values are preserved. Prisma reports **no schema difference**. Existing administrator credentials were not changed. Do not rerun this one-time SQL on the same database. A different production database must be checked separately.

## Canonical routes

| Purpose | URL path |
| --- | --- |
| Customer login | `/login` |
| Customer account | `/account` |
| Admin login | `/admin/login` |
| Admin dashboard | `/admin/dashboard` |
| Admin entry | `/admin` → own admin login, or dashboard for a signed-in admin |
| Supplier login | `/suppliers/login` |
| Supplier dashboard | `/suppliers/dashboard` |
| Old supplier login | `/supplier/login` → `/suppliers/login` |
| Old supplier pages | `/supplier/<section>` → `/suppliers/<section>` |
| Customer tracking | `/track-order`, customer sign-in required |

Storefront links and API requests use relative paths; they work on localhost and the deployed domain without embedding localhost URLs. The supplier and admin portals do not show customer navigation.

## Supplier credentials

Under Admin → Suppliers, direct supplier registration generates an editable login ID and strong initial password and creates the supplier/account/contact in one transaction. Administrators can change IDs, reset passwords and disable accounts. Resetting credentials increments the session version and invalidates old sessions. Passwords are hashed, never returned by read APIs, and never written to audit details. The initial/reset password is available in the current admin operation for private sharing. External-site sourcing records do not receive portal logins.

## Vercel settings

- Project: the existing `zera16/zera-world` project connected to this repository's `main` branch.
- Framework: Next.js. Root directory: repository root. Build command: `npm run build`.
- The build checks production environment prerequisites, regenerates Prisma Client, then runs `next build` with lint/type checks enabled. It does not run destructive database commands or automatically replay the one-time SQL.
- Set `DATABASE_URL`, a strong `JWT_SECRET` (at least 32 characters), and `INTEGRATION_ENCRYPTION_KEY` (base64-encoded 32-byte key) for Vercel **Production**. Use the same intended database and encryption key as the configured store. Store values privately in Vercel; never commit `.env`.
- Configure Cloudinary and Razorpay server credentials, the public Cloudinary cloud name, and `APP_URL` / `NEXT_PUBLIC_APP_URL=https://zerasworld.in`. Set support details as described in `NAVIGATION_UPDATE.md`.
- After deployment, `/api/health` must report `status: ok`, `version: store-portals-v1`, the new Vercel commit, and a `databaseTarget` fingerprint matching localhost. The fingerprint contains no hostname, password or connection URL.

The Vercel CLI login was invalid during diagnosis. GitHub publication can still trigger the connected Vercel build. If account settings need changes, the owner must reconnect using `vercel login` or use the Vercel dashboard. A successful local build alone does not prove that a production deployment has completed.

## Provider checks and remaining configuration

Cloudinary authenticated successfully. The currently configured Razorpay test credentials returned **HTTP 401** on a read-only API check; replace them with active keys before testing payments. No live payment, refund, courier booking or supplier purchase was performed. Courier tracking requires a valid account-owned AWB and Delhivery token. Marketplace credential storage does not imply live Amazon/Flipkart synchronization.

The three star icons above the homepage category cards were removed; the cards and links remain.

## Verification

- 76 automated tests passed, including supplier password hashing, admin-only credential edits, session invalidation, supplier/customer isolation, GST/handling, ten-unit cart limits and rejection of damaged/reserved/in-transit inventory at checkout.
- Browser checks passed for 19 admin pages and 10 supplier pages. The actual database flow passed registration, login-ID/password editing, old-session revocation, product assignment, saved customer addresses, price quoting, supplier acceptance/packing/dispatch, admin delivery confirmation, customer return request and finance CSV export.
- 25 public pages/redirects and anonymous API restrictions passed. A temporary contact submission was verified in the database and removed.
- Temporary QA records were removed. Original records were verified against the backup; a separate newly registered customer account was left untouched.
- The workflow used temporary manual-payment fixtures. No real gateway charge/refund, carrier booking or supplier purchase was made.

References: [Vercel build troubleshooting](https://vercel.com/docs/deployments/troubleshoot-a-build), [Prisma 6 transaction configuration](https://www.prisma.io/docs/orm/v6/reference/prisma-client-reference#transactionoptions). This repository remains on Prisma 6; no version upgrade was introduced.
