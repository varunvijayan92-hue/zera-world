# Store verification — 3 November 2026

## Changes verified

- Supplier registration accepts structured pickup/local addresses. Admins can edit them under Suppliers; suppliers have a dedicated Pickup / Local Address menu. Address changes clear the old Shiprocket mapping for review and preserve company details.
- Supplier navigation uses a mobile drawer with keyboard dismissal and focus handling. All supplier menu destinations were opened at mobile width.
- Shipping remains a flat ₹120 per order, including carts above ₹999. The header, product page and shipping policy now agree. Removed the unused currency selector, misleading Wishlist link and unused product delivery-charge input.
- Public product data excludes supplier identities, purchase costs and internal fields.
- Customer returns display item receipt separately from refund status. COD returns do not offer a Razorpay refund action; eligible gateway refunds offer status reconciliation.

## Results

- 146 automated tests pass.
- Production build, ESLint and TypeScript checks pass.
- The earlier live store audit covered 90 distinct checks across public pages, every admin menu, customer checkout/account, supplier fulfilment, returns, access restrictions and responsive layouts. The Cloudinary upload assertion initially expected 200 instead of the API's successful 201 response; the corrected upload/delivery check passed and the temporary image was removed.
- Additional supplier catalogue and COD regressions passed. The Shiprocket webhook smoke check passed on rerun: authentication, test acknowledgement, unmatched AWB safety and admin-only setup controls.
- Address browser regression passed against the local production build: registration persistence, supplier edit, admin edit, stale mapping removal, preserved company data, all supplier menu links and widths 320/390/768/1440.
- Tests used temporary records that were removed. No real payment, refund, courier booking or outbound test email was issued.

## Outstanding work and limits

1. **Stock reservation:** checkout validates available inventory, but code inspection found no automatic order reservation or stock deduction. Concurrent orders can oversell; a complete reservation/release lifecycle is still needed. This was identified by code review, not a live oversell experiment.
2. **Razorpay:** production credentials/webhook configuration were unavailable during the audit, so real prepaid payments and refunds remain unverified. The payment webhook returned configuration-unavailable status.
3. **Refund operations:** COD repayments require manual handling. Automated refund-status webhooks, reverse-pickup booking and returned-stock restoration are not complete. Gateway timeouts without a saved refund ID still require manual reconciliation.
4. **Courier pickup:** saving an app address does not create a Shiprocket pickup location or book collection. Admin must link the registered Shiprocket pickup name; AWBs must already be booked with the courier.
5. **Email:** OTP validation and reset/session-revocation logic passed using temporary challenges; actual inbox delivery was not exercised in this audit.
6. **Dependencies:** the production dependency audit reported 8 high and 1 moderate advisories. Major dependency upgrades need a separate compatibility review.

These results verify the exercised flows; they do not certify every external integration or a complete production launch.
