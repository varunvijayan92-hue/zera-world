# Amazon and Flipkart integration review

Reviewed 3 November 2026. No real listing, marketplace order, refund or courier booking was created during this review.

## Current state

The shared database has no Amazon or Flipkart credentials, marketplace accounts, product mappings or synchronization jobs. Seller Channels stores encrypted credentials but has no live marketplace adapter. Shiprocket is configured for website shipments; that does not connect marketplace fulfilment.

| Flow | Current implementation | Required before enabling |
| --- | --- | --- |
| Product publication | Local product save; no external publication | Seller approval, channel SKU/listing identifiers, category attributes, price/stock feed and acknowledgement handling |
| Order import | Management-only local order creation | Authenticated order API/notifications, pagination/checkpoints, durable deduplication and item mapping |
| Supplier fulfilment | Website paid/COD orders supported | Channel order-item assignment and marketplace payment eligibility; do not require Razorpay payment for marketplace orders |
| Pickup and delivery | Website Shiprocket/Delhivery AWB recording and tracking | Channel fulfilment mode, seller-location-to-supplier mapping, marketplace labels/manifests or approved Self Ship courier dispatch |
| Returns and refunds | Website customer returns and Razorpay flow | Marketplace return IDs/events, native-channel approvals/refunds, reverse pickup, item receipt and settlement adjustments |

## Corrections made

- Removed hardcoded Amazon Connected / two-minute sync claims.
- Product preparation returns PENDING with no fabricated listing ID, success acknowledgement or fallback image.
- Supplier dispatch preparation no longer says the order was sent.
- Removed invented supplier references, queue/job IDs and process-memory duplicate protection from workflow previews. No durable job is claimed without a persisted job.
- Manual order creation no longer invents supplier stock, purchase costs or shipping quotes. Duplicate local marketplace-order keys return 409.
- Seller Channels now shows which flows require connectors, alongside saved credential state and fulfilment guidance.

## Important model gaps

Website checkout currently stores `marketplaceType: AMAZON` because the enum only includes Amazon and Flipkart. Marketplace ingestion must not be enabled until website orders have a distinct source and existing website records are migrated safely. Their customer IDs and `ORDER-` references can help identify records, but the migration needs explicit provenance rules.

Supplier fulfilment currently requires an internal PAID payment or eligible COD transaction. Marketplace-imported orders need their own verified channel payment/fulfilment rules, rather than a fabricated Razorpay transaction.

Existing Shiprocket tracking does not book pickups or reverse pickups. Marketplace scheduling, shipment confirmation, cancellations, returns and settlements are not implemented.

## Intended order flow

1. Authorize the seller account and choose its fulfilment program.
2. Map channel listing SKUs, product variants, stock and seller location IDs to local products and suppliers.
3. Publish approved listings and persist real acknowledgements before reporting success.
4. Import a real channel order idempotently; assign its items to the mapped supplier/location.
5. Pack the order with channel-required invoice and label information.
6. For marketplace fulfilment, request pickup through that marketplace. For Self Ship, book an eligible courier, then report the real AWB and dispatch details to the marketplace.
7. Import delivery and return events. Process returns/refunds in the original marketplace and reconcile inventory, fees and settlements.

## Selected delivery plan

The seller selected Amazon Easy Ship and Flipkart logistics (standard fulfilment). Pickup must be scheduled through the respective marketplace from its approved seller address/location. An arbitrary supplier address in this app is not automatically registered with either marketplace.

## Seller input still required

- Approved Amazon SP-API and Flipkart application credentials, entered in Admin → Seller channels.
- Confirmation that Easy Ship and Flipkart standard fulfilment are enabled for the approved seller accounts and pickup locations.
- Registered seller location IDs and the suppliers permitted to dispatch from each location.
- Existing listing SKUs/ASINs/FSNs and product-category requirements.

Official references: [Amazon SP-API onboarding](https://developer-docs.amazon.com/sp-api/docs/onboarding-overview), [Amazon shipping programs](https://developer-docs.amazon.com/sp-api/lang-en_US/docs/retrieve-list-of-shipments), [Flipkart order/return workflows](https://seller.flipkart.com/api-docs/order-api-docs/OMAPIOverview.html), [Flipkart Self Ship dispatch](https://seller.flipkart.com/api-docs/order-api-docs/SelfShipDispatch.html).
