# Customer WhatsApp order updates

Fast2SMS is configured as the server-side WhatsApp provider. The API key is stored in the ignored local environment and Vercel Production secrets; it is never bundled into the website or Android APK.

Customer registration now requires an Indian WhatsApp phone number. The registration checkbox is off by default. Customers can add/change their number in My account → Profile & language and enable/disable WhatsApp updates in My account → Notifications. Existing customers are opted out unless they explicitly enable the channel. Account email/password sign-in and email registration verification continue to work.

## Automatic events

| Event | Trigger | Template message ID | Template variable |
| --- | --- | --- | --- |
| Order placed | Successful server-priced checkout transaction | 44405 (`zera_order_placed_v1`) | Order/customer/total/status summary |
| Payment received | Captured Razorpay payment, full gift-card payment, or recorded COD receipt | 44404 (`payment_completed`) | Paid amount |
| Dispatched | Admin/supplier records a shipment | 44406 (`zera_order_shipped_v1`) | Order, courier and tracking summary |
| Delivered | Admin confirms delivery | 44407 (`zera_order_delivered_v1`) | Order/delivery/receipt summary |

The existing payment template was pending when checked. The order, dispatched and delivered UTILITY templates were created and submitted for approval during this update; their content is in [whatsapp-templates.json](whatsapp-templates.json). No customer test message was sent. Approval status is checked against Fast2SMS before every send. A configured template ID is not proof of approval.

These automatic text templates use one variable each. The payment template expects an amount; the other three expect a summary. Do not substitute a template with a different variable contract. The generic manual API supports multiple variable values and optional media when the selected approved template requires it.

## Queue and safety behavior

Notification events are inserted inside the order/payment/shipment transaction, then processed after the HTTP response. Deterministic event IDs prevent duplicate Razorpay callbacks from creating duplicate payment updates. Separate supplier shipments retain separate tracking references. Events are not sent to inactive or opted-out customers. The destination is the customer's registered account phone, rather than another recipient's checkout address phone.

Statuses are `QUEUED`, `SENDING`, `ACCEPTED`, `BLOCKED`, `UNKNOWN` and `SKIPPED`. `ACCEPTED` means the provider accepted the request, not that WhatsApp delivery has been confirmed. Unapproved/missing templates are `BLOCKED`; they can be retried after approval. Provider timeouts become `UNKNOWN` and are not automatically resent. Old `SENDING` records also need manual provider-log review. Events older than 24 hours are skipped rather than sending a backlog of stale updates.

New store events process queued notifications and eligible older blocked records. Administrators can also use Settings → WhatsApp order updates → Retry eligible pending updates. There is no bulk mailing job and no automatic marketing campaign.

## Admin and Android APIs

All endpoints require an authenticated ADMIN; managers, suppliers and customers cannot use the administrative send/configuration routes.

| Method | Website endpoint | Android endpoint |
| --- | --- | --- |
| GET | `/api/admin/integrations/whatsapp` | `/api/mobile/admin/integrations/whatsapp` |
| POST | `/api/admin/whatsapp/messages` | `/api/mobile/admin/whatsapp/messages` |
| GET / POST | `/api/admin/whatsapp/notifications` | `/api/mobile/admin/whatsapp/notifications` |

The connection endpoint returns connected senders and template approval metadata, without the API key. The notifications GET returns recent event statuses and configured template mappings. POST `{"action":"RETRY_PENDING"}` processes an eligible batch.

Example manual send payload, to use only with an approved template and the intended recipient:

```json
{
  "submissionId": "f316e09c-7792-44dc-b8ef-c408ce21c263",
  "messageId": "44404",
  "to": "+919876543210",
  "variables": ["499.00"]
}
```

Retain the same submission UUID after a network timeout. Accepted requests return HTTP 202 and `data.requestId`; an identical replay returns the original acceptance without another send. Reusing the UUID for a different payload is rejected. Do not generate a new UUID to bypass an uncertain send; check provider logs first.

## Configuration and database

Production variables are `FAST2SMS_API_KEY`, `FAST2SMS_WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_NOTIFICATIONS_ENABLED=true`, and the four `FAST2SMS_WHATSAPP_*_TEMPLATE_ID` mappings shown in [.env.example](.env.example). Local automatic sending remains disabled. An encrypted `FAST2SMS_WHATSAPP` override can be saved through Admin Settings; blank fields preserve saved values.

[prisma/changes/add-whatsapp-notifications.sql](prisma/changes/add-whatsapp-notifications.sql) adds the consent and notification-outbox tables. The configured database was backed up before this additive change. Existing customers, products, orders and prices were preserved. Do not run destructive schema reset commands.

Provider references: [template sending](https://docs.fast2sms.com/reference/sendwhatsappmessage), [sender/template lookup](https://docs.fast2sms.com/reference/get-waba-template-details), [template creation](https://docs.fast2sms.com/reference/createtexttemplate).
