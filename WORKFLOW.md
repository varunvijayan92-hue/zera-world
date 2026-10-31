# ZeraWorld working flow

See [STORE_EXPANSION.md](STORE_EXPANSION.md) for the full current workflow, route list, API settings, schema upgrade and verification requirements. The new schema update is prepared and requires approval before production application.

1. Admin creates categories and uploads Cloudinary category images; the website category banners use them.
2. Admin creates products with selling/supply prices, GST, per-unit handling, stock, supplier assignment and return policy. Product photos remain in Cloudinary.
3. Customers register or sign in, browse products and add up to 10 total units to their cart. From the cart, they confirm quantities and a saved, manual or GPS-assisted delivery address.
4. The backend quotes database prices, per-product GST, handling and INR 120 delivery. The customer confirms and opens the separate Razorpay payment page for supported UPI/QR options.
5. Signature and captured-payment checks confirm payment. Signed-in orders appear under My account. Guest orders are not linked to later registrations by email.
6. Direct suppliers use their separate portal to accept, process, pack and enter an already-booked Delhivery AWB for assigned paid order lines. Submitted supplier products require admin publication.
7. External-site purchases use a separate admin sourcing menu, with purchase URLs and external references. Recording these purchases does not place external orders.
8. Admin and customers can refresh Delhivery scans with valid courier API configuration. Admin confirms actual delivery to start the saved return window.
9. Eligible customers submit a reason and quantity from account Orders. Admin approves/rejects, confirms receipt, and may explicitly submit/reconcile a Razorpay item-price-plus-GST refund. Shipping and handling are excluded. Admin can record RTO and suppliers can confirm physical receipt.
10. Finance date filters/CSV show paid sales, GST, handling, saved supply cost, shipment costs, expenses, returns and processed return-refund records. This is an estimate, not a complete accounting ledger.

## Account menus

Orders, Addresses, Profile & language preferences, Notifications preferences, issued Gift cards & vouchers, Questions & answers. The account icon appears for signed-in customers. Address saving while signed in works across sessions; guest saving uses localStorage. Language preferences do not translate pages; notification preferences do not send messages; voucher redemption is not implemented.

## Admin and supplier access

Admin uses `/admin/login` and `/admin/dashboard`; the sidebar includes Returns & RTO and Seller channels in addition to the original 16 sections. ADMIN manages credentials and users; MANAGER manages store operations. Suppliers use `/supplier/login` and `/supplier/dashboard` with supplier-only database scope. Customers use `/login`, `/account` and `/track-order` with customer-only database scope. `/dashboard` remains an admin alias.

## Integrations and limits

Settings stores encrypted Razorpay/Delhivery credentials; Seller channels stores Amazon/Flipkart account credentials. Saved configuration is not evidence of a live connection. Approved marketplace synchronization, automatic supplier purchases, reverse pickup booking, notifications, voucher redemption, full accounting reconciliation and stock reservation/deduction after payment remain separate work. Last tested Razorpay credentials were rejected with HTTP 401.

GPS suggestions use Photon after permission; configure `GEOCODING_BASE_URL` for suitable production service. Raw coordinates are not stored. Product GST is exclusive of selling price; the business must confirm rates and handling-tax treatment before launch.

Deployment details: [DEPLOYMENT.md](DEPLOYMENT.md), [STORE_EXPANSION.md](STORE_EXPANSION.md), [RAZORPAY_SETUP.md](RAZORPAY_SETUP.md).
