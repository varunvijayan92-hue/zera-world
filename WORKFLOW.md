# ZeraWorld storefront workflow

The website supports guest checkout and a protected admin panel with the full sidebar for store content, operations, finance and system records. Product photos use Cloudinary and menu categories are database-backed.

## Customer journey

1. Browse the home page or Shop (`/products`) and open product details if needed.
2. Click **Select item** to open order confirmation (`/checkout`). Repeated selections merge into one quantity.
3. Confirm the quantity or remove unwanted items. A server quote checks prices and stock, updating subtotal, tax, delivery and the final amount. This step does not create an order or start payment.
4. Enter contact and delivery details, or click **Use my current location**. Browser permission is requested before coordinates are sent for address lookup. Check the suggested house/flat number and postal code; every field remains editable.
5. Optionally tick **Save this address for my next shipment**. It is saved in this browser and can be reused or forgotten next time. No customer account is required.
6. Click **Confirm & continue to payment**. A validated temporary draft opens `/checkout/payment`. Drafts expire after 30 minutes.
7. Review the confirmed address and amount, then choose **UPI apps** or **Scan a UPI QR code**. Razorpay controls supported apps and QR availability for the account and device.
8. Click Pay. The backend revalidates prices, stock and the confirmed total, then saves the pending order and creates a Razorpay order. If the total changed, payment is blocked until the customer reviews it again.
9. Complete Razorpay Checkout. The server verifies the returned signature and fetches the payment to check its order, amount, currency and capture status. Captured payments confirm the order; authorized payments remain pending capture.
10. The result page shows saved payment status and the order reference. Cancellation, payment failure and verification retry are supported. Store content tools are separate from the customer checkout.

## What happens after payment

The verified payment and confirmed order are saved in PostgreSQL. There is currently no automatic supplier purchase, warehouse dispatch, shipping integration, tracking update or confirmation email after that step. Those integrations must be implemented before the store can fulfil orders automatically.

The marketplace helpers currently return simulated status/results; they do not publish products or import live Amazon/Flipkart orders. Storefront orders also currently use the AMAZON enum as an internal placeholder, which does not create an Amazon order.

## Managing store content and supplier integrations

Sign in at `/admin/login` to open `/admin/dashboard`. All 16 requested sidebar entries have pages. Products and Categories retain the Cloudinary/photo/menu tools; other sections show existing order, stock, supplier, payment, shipment and sync data. Inventory edits, supplier creation and expense recording are supported. User administration is restricted to ADMIN accounts; MANAGER accounts can use other management sections. Existing `/dashboard` URLs redirect to their matching `/admin` pages. See `STORE_ADMIN_SETUP.md` for the complete menu and current limits.

Automatic supplier APIs remain the selected operating model for supplier catalog/stock/fulfilment automation. The supplier and its API documentation are still needed before a live connector can be implemented. Store content can now also be managed manually through the protected admin pages.

### Intended supplier API flow (not implemented yet)

1. A background sync imports supplier products, variants, images, purchase prices and stock into the store database. Each imported item retains its supplier product ID and SKU.
2. The store applies a configured selling-price rule and publishes only eligible products. Shipping destinations and delivery estimates come from the supplier where supported.
3. Scheduled updates or verified supplier webhooks refresh price and stock. Unavailable or stale products are withheld according to the agreed policy.
4. At checkout the backend rechecks supplier availability, shipping eligibility and cost before collecting payment. It reserves stock if the supplier supports reservations; otherwise post-payment availability failures need a defined cancellation/refund path.
5. A verified captured payment creates a persistent fulfilment job. The job sends the mapped items and delivery details to the supplier once, with retry and reconciliation rules supported by that supplier's API.
6. The store records the supplier's actual acknowledgement and supplier order reference. An API timeout alone must not cause an unverified second purchase.
7. Supplier webhooks or polling update acceptance, dispatch, carrier, tracking and delivery status. Customer tracking and notifications will need to be built to expose these updates.
8. Rejections, out-of-stock changes and uncertain API responses enter a persistent exception queue and notify the store owner through a channel still to be chosen. They must not be reported as successfully fulfilled.

Connector requirements: supplier name, official API documentation, API access method, sandbox availability, selling-price rules, permitted shipping regions and the exception-notification destination. Product sync, purchasing, tracking, cancellations and refunds depend on the supplier's supported endpoints. Credentials will be configured in the server environment.

## Current limits to review

- Customer registration/sign-in forms are demos and do not create customer accounts or authenticate customers.
- Customers cannot yet view their order history, check live payment status or track shipments.
- Stock is checked when checkout starts, but is not reserved while the customer pays or automatically deducted after capture.
- The home-page search box and some promotional navigation are presentation elements; catalog search is available on `/products`.
- Refund processing has a protected backend endpoint, but no customer returns portal or operator interface. Gateway results must be reconciled before retrying an uncertain refund.

## Before deployment

Apply the shipping-address schema update with `npm run db:push` against the intended database after backing it up. Set `JWT_SECRET` to a random value of at least 32 characters for protected API authentication. Configure and test Razorpay credentials and webhook delivery. Rotate any webhook secret exposed by the old test endpoint. Confirm the shipping and tax settings and configure the chosen supplier API integration.

See `DEPLOYMENT.md` for configuration details.

Razorpay setup and test instructions: see `RAZORPAY_SETUP.md`.

## Location and saved-address setup

GPS lookup uses Photon with OpenStreetMap data after the customer requests it and grants browser location access. Configure `GEOCODING_BASE_URL` to a compatible managed or self-hosted Photon instance for production volume; the default public instance has no availability guarantee. HTTPS (or localhost) is required for browser geolocation. Denial, lookup failure and incomplete suggestions leave manual entry available. Raw coordinates are not saved in browser storage or order records.

Saved delivery addresses stay in localStorage on the same browser, including recipient contact details, only when the checkbox is selected. Forget address deletes the saved copy. A one-time address does not overwrite an older saved address when saving is unticked. The temporary payment draft uses sessionStorage.
