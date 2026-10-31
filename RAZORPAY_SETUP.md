# Razorpay Standard Checkout

This project uses Next.js App Router, TypeScript and Prisma/PostgreSQL. The integration reuses the existing checkout, payment transactions and customer orders. The restored admin sidebar and its product/photo/menu and operations pages are documented in `STORE_ADMIN_SETUP.md`.

## Environment

The supplied test keys have been configured in the local `.env`. `.env` is ignored and has been removed from Git tracking. `.env.example` contains empty placeholders. Restart Next.js after changing keys.

```dotenv
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=
RAZORPAY_WEBHOOK_SECRET=
```

The browser receives only the public key ID from the server's create-order response so it matches the order's credentials. The key secret is used only on the server. The webhook secret is a separate value configured in Razorpay; it is not the API key secret.

## Endpoints

`POST /api/create-order` delegates to the existing `POST /api/payments/checkout` handler. Submit the cart, delivery address, payment method and a UUID idempotency key using the checkout form. The backend calculates the amount from current database product prices and sends `{ amount, currency, receipt }` to Razorpay through the official Node SDK. Amounts sent to Razorpay are integer paise, with a minimum of 100 paise. A browser-supplied amount is not used as the product price.

The response includes `{ order_id, amount, currency }`, where `amount` is in paise, plus the existing `data.order`, `data.payment` and `data.amount` fields. Missing credentials and gateway errors fail explicitly; Razorpay checkout does not fall back to a simulated payment.

`POST /api/verify-payment` accepts:

```json
{
  "razorpay_payment_id": "pay_example",
  "razorpay_order_id": "order_example",
  "razorpay_signature": "64-character hexadecimal signature"
}
```

The server looks up the saved gateway order ID, computes HMAC-SHA256 of `stored_order_id + "|" + payment_id` with the API key secret, and compares signatures using a timing-safe comparison. Missing fields, unknown orders and signature mismatches return 400 without marking the order paid.

After a valid signature, the server fetches the payment from Razorpay and checks its order, amount and currency. Captured payments become PAID and confirm the local order atomically. Authorized payments remain AUTHORIZED until capture is confirmed. Refund/cancellation states are not overwritten. Gateway authentication failures return 401; other gateway/server failures return 500.

`POST /api/payments/webhook` remains available for asynchronous reconciliation, including cases where the customer closes the tab before verification. Configure a webhook secret separately.

## Browser behavior

The checkout loads `https://checkout.razorpay.com/v1/checkout.js`, creates the order and opens the modal. The success handler submits all three returned signature fields to `/api/verify-payment` before redirecting. The result page reads the saved payment status instead of trusting a URL flag.

Cancellation and failed payments show an error and allow the same modal order to be reopened. Retrying verification in the same page session reuses the signed payment response and does not start another payment. Duplicate clicks are blocked while checkout or verification is active. A failed SDK script load shows an error before creating an order.

## Test locally

1. Confirm the configured PostgreSQL database is reachable. The existing nullable `CustomerOrder.shippingAddress` field has been added to the configured database; apply the same schema update to any other deployment database before using checkout.
2. Ensure there is an ACTIVE product with a positive selling price and unreserved inventory. For a fresh demo database, `npm run db:seed:sample` supplies sample catalog records; it skips seeding when suppliers already exist.
3. Run `npm run dev` and open `http://localhost:3000/products`.
4. Click **Select item**, confirm quantity and delivery details (with optional GPS and address saving), then click **Confirm & continue to payment**. Choose UPI apps or QR on the payment page and click Pay.
5. Test the supported UPI Intent/QR options offered by the Razorpay Test Mode account. Standard Checkout handles available apps and flows; do not add a custom UPI Collect form. Check account/device support in Razorpay if a flow is unavailable.
6. A captured successful payment should display **Payment verified** and clear the browser cart. An authorized payment displays confirmation pending. Dismiss the modal and test failure to check that errors are shown and retry is possible.

Run `npm test` for automated API/signature/modal tests and `npm run build` for production compilation. Automated HTTP smoke tests created a sandbox order and confirmed a forged signature returns 400 while the saved transaction stays PENDING. Temporary smoke-test product and local order records were removed. No payment was charged during these checks; a completed browser sandbox payment still needs to be exercised manually.

## Razorpay account setup

Enable automatic capture in the Razorpay account or define a separate capture process. For webhook reconciliation, configure the deployed HTTPS `/api/payments/webhook` URL and subscribe to `payment.captured`, `payment.authorized` and `payment.failed`. Set its separate secret in the deployment environment. A public HTTPS tunnel is needed to receive webhooks on localhost.

Set the environment variables separately on the hosting provider. The current keys are test keys; switching to live keys is a separate deployment action.

During SDK installation, npm reported 21 dependency audit findings (15 moderate and 6 high). Broad dependency upgrades were not included in this payment integration. Review those findings before a live deployment; the later standalone audit did not complete and was stopped.

Official reference: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/

## Files changed for this integration

Created:

- `app/api/create-order/route.ts`: alias for the existing cart-priced order creation flow.
- `app/api/verify-payment/route.ts`: signature, amount, currency and capture verification.
- `lib/razorpay.ts`: environment configuration, SDK access, minimum amount and safe gateway errors.
- `lib/razorpay-browser.ts`: typed script loader and modal success/failure/cancellation handling.
- `tests/razorpay-integration.test.ts`: endpoint and payment-state regression tests.
- `tests/razorpay-browser.test.ts`: modal success/failure/dismissal tests.
- `RAZORPAY_SETUP.md`: setup, endpoint behavior and manual testing.

Modified:

- `app/api/payments/checkout/route.ts`: Standard Checkout response fields and gateway error handling.
- `app/checkout/page.tsx`: item, quantity and delivery address confirmation.
- `app/checkout/payment/page.tsx`: UPI/QR choice, create-order request, modal flow and verification.
- `app/checkout/success/page.tsx`: database-backed payment result.
- `lib/payment.ts`: existing Razorpay order creation now uses the official SDK and fails closed.
- `tests/payment-flow.test.ts`: missing-credentials behavior.
- `package.json` and `package-lock.json`: Razorpay SDK dependency.
- `.env`: supplied credentials, kept locally and removed from Git tracking.
- `.env.example`: empty Razorpay environment placeholders.
- `.gitignore`: environment-file exclusion rules.
- `WORKFLOW.md` and `DEPLOYMENT.md`: updated payment flow and setup references.

## Confirmation, location and saved addresses

`/api/checkout/quote` checks totals without creating an order or payment. The payment request includes the amount the customer confirmed; a changed total returns 409 before order creation. `/api/address/locate` validates coordinates and returns an editable Photon address suggestion. Configure `GEOCODING_BASE_URL` for a compatible private/managed instance when serving production traffic. Browser geolocation needs HTTPS or localhost and permission.

The save-address checkbox persists the recipient/address in the same browser only; Forget address removes it. A validated payment draft uses sessionStorage and expires after 30 minutes. The helpers are `lib/cart.ts`, `lib/checkout-storage.ts` and `lib/geocoding.ts`. New UI components are `components/checkout-summary.tsx` and `components/delivery-address-fields.tsx`. `tests/checkout-review.test.ts` covers the confirmation, storage and geocoding behavior.

UPI reference: https://razorpay.com/docs/payments/payment-methods/upi/faqs/
Photon reference: https://github.com/komoot/photon

Browser verification covered product selection, quantity changes, server totals, GPS filling and permission denial, saved-address reuse/removal, QR/UPI configuration, cancellation, failed payments and signature retry. The location endpoint was also checked against the real Photon service. Razorpay modal/order responses were simulated for these UI checks: a separate real SDK check now returns HTTP 401 for the configured test credentials. Active test keys are needed to recheck actual gateway order creation and complete a sandbox payment. No real payment was made.
