# Gift cards, reorder and shipment bills

Admins issue a card under `/admin/gift-cards` to an active customer's registered email. A unique code, value and optional expiry are recorded in the existing CustomerVoucher table, with an issuance audit. Managers have read access. Card codes and balances appear only in the assigned customer's account. Creation does not charge a bank account or send email.

At `/checkout/payment`, the customer selects Gift card and a valid card covering the full order total. Split gift-card/gateway payments are not supported. The balance debit, confirmed order, PAID GIFT_CARD payment and redemption audit commit in one serializable transaction. A conditional balance update prevents concurrent overspending. The checkout reference is retained for safe retries. Unused balance remains available for another purchase.

The normal delivery and product return policy applies. After admin approval and physical receipt, the return action credits item price plus GST back to the original gift card. Delivery and handling are excluded under the existing return policy. A completed return receives one refund record. An expired original card is renewed for 30 days when its return credit is restored. There is no gateway transfer for a gift-card refund.

Apply `prisma/gift-card-payment.sql` before deploying this version against a new database, then regenerate Prisma. It adds the GIFT_CARD provider and an optional PaymentTransaction.giftCardId foreign key. The configured shared database was updated during implementation.

Account Orders provides Reorder using current active product data and availability, adding one unit to the cart and opening checkout for quantity/address confirmation. Unavailable products disable the action. Return product follows delivery confirmation, the order-time return policy and remaining eligible quantity; the policy link is always available.

Customer-facing pricing remains inclusive. Admin order receipts and supplier shipment bills show GST, delivery and handling separately. Supplier bills include only assigned items and a deterministic share of delivery, so multiple suppliers do not each receive the full order delivery allocation.
