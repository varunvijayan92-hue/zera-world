> Current status (2026-11-01): The configured database has now been backed up and upgraded, preserving original records. Supplier login IDs and session invalidation are included. See [DEPLOYMENT_FIX.md](DEPLOYMENT_FIX.md) for current deployment status and canonical `/suppliers/login` routes. Earlier pending-migration statements below describe the prior stage.

# Storefront navigation and information pages

The shared storefront header now has four shopping links: Home, Shop, Categories and New Arrivals. Collections is renamed Categories; Featured is replaced by New Arrivals; Journal is removed from the homepage. About and Contact are footer links.

The footer appears across customer pages, including checkout, and links to:

- `/about` — About Us, using the supplied Zera's World content.
- `/contact` — Contact Us, using the supplied introduction, enquiry topics and five-field form.
- `/privacy` — Privacy Policy, including account/address and contact-message handling.
- `/terms` — Terms & Conditions, a short shopping information summary.
- `/shipping` — Shipping Policy, including checkout charges, supplier dispatch, tracking and support.
- `/returns` — Return & Refund Policy, with account orders and contact support links.
- `/track-order` — the existing customer tracking page; signing in is required to view personal orders.

Header/footer navigation is hidden on admin, supplier and legacy dashboard routes. Admin menus remain intact; Contact requests is added so website enquiries have an operator inbox.

## Contact form flow

The form accepts full name, email, optional order number, subject and message. `/api/contact` checks the request origin, validates field lengths, applies a per-instance rate limit and honeypot, and saves the message to the existing `AuditLog` table with `CONTACT_REQUEST` / `ContactMessage`. It returns a reference only after storage succeeds. A failed save leaves the customer's form intact and displays an error.

Messages appear at `/admin/contact-messages` for ADMIN/MANAGER only. Replies are sent manually using the business support mailbox. This update does not send emails or claim an email integration is connected. A shared deployment-edge rate limit is recommended for sustained public traffic; the application limit is per server instance.

This update adds no database tables and requires no additional schema migration. The earlier store/supplier expansion migration remains unapplied and still requires separate approval; catalog/category functionality depending on that expansion needs that schema before deployment.

## Business details to provide

Set the following server environment variables after confirming the real business information:

```dotenv
SUPPORT_EMAIL=
SUPPORT_PHONE=
BUSINESS_ADDRESS=
SUPPORT_HOURS=
SUPPORT_RESPONSE_TIME=
```

Unconfigured details and response-time promises are omitted from the public page. No bracketed placeholders or invented phone/email/address are shown. Redeploy after changing these values because the Contact page is generated at build time. Confirm the shipping/return arrangements and complete the business/grievance contact details before publishing policy pages. The policy summaries do not claim to establish legal compliance. Reference reviewed: [Department of Consumer Affairs — Consumer Protection (E-Commerce) Rules](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf).

## Files

Created: `lib/storefront-navigation.ts`, `lib/contact.ts`, `components/storefront-chrome.tsx`, `components/store-information-page.tsx`, `components/contact-form.tsx`, `app/about/page.tsx`, `app/contact/page.tsx`, `app/categories/page.tsx`, `app/new-arrivals/page.tsx`, `app/terms/page.tsx`, `app/shipping/page.tsx`, `app/api/contact/route.ts`, `app/admin/contact-messages/page.tsx`, `tests/contact-navigation.test.ts`, this file.

Updated: `app/layout.tsx`, `app/page.tsx`, `app/products/page.tsx`, `app/privacy/page.tsx`, `app/returns/page.tsx`, `lib/admin-navigation.ts`, `tests/admin-operations.test.ts`, `.env.example`.

## Checks

- `npm test` — 66 tests passed, including navigation separation, contact validation, persistence failures, cross-origin rejection and rate limiting. Database calls are mocked in these tests.
- `npx tsc --noEmit --incremental false` — passed.
- Browser checks cover desktop/mobile information pages and contact submission with a mocked API; no test messages are written to production.
- `npm run build` ? passed, including the existing Next.js lint/type validation.

For manual review, start `npm run dev`, inspect `/about` and `/contact`, check all footer destinations, then submit a real approved test enquiry and verify it in the protected admin inbox. No production data has been changed or deployment performed by this update.
