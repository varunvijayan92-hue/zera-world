# Android workflow audit

The original Android project had deployed APIs but routed most admin menus to a placeholder that did not render records or actions. The legacy product creation action discarded several website product fields. Product stock updates also sent `availableQty` where the dedicated endpoint requires `quantity`.

## Changes

`ConnectedAdminScreens.kt` replaces the admin placeholder with paginated records and explicit workflow forms. Product editing uses `/api/mobile/products`, category editing uses `/api/mobile/admin/categories`, and stock-record editing retains `updatedAt` for conflict detection. Errors are displayed and save controls are disabled during requests. The photo picker uploads device bytes after product creation, retaining the created product ID when an upload fails.

The order/invoice detail API now includes a selected `payments` array. Android only offers COD collection for a delivered order with a pending COD payment. The receipt screen shows order-time line items and totals and exports a paginated PDF. It describes the document as an order summary, consistent with the website; it does not invent a numbered tax invoice.

The Android build now uses explicit plugin/dependency declarations instead of a missing version catalog. A Gradle 8.11.1 wrapper is included. Use JDK 17. Build output, SDK paths and Gradle caches are ignored.

## Workflow coverage

| Workflow | Native connection | Verification |
| --- | --- | --- |
| Category create/edit, hierarchy, visibility, display order | Connected | Live hidden QA category created, edited and removed |
| Category photo | Connected | Live Cloudinary upload and cleanup passed |
| Category delete | Connected, explicit confirmation | Live temporary category deletion passed |
| Inventory available/reserved/damaged/safety quantities | Connected with version token | Live save passed; stale-version save rejected with 409 |
| Product create/edit, category/supplier selection, prices, MRP, HSN, attributes, tax/return/COD fields | Connected | Live draft create/edit/readback and cleanup passed |
| Manual product stock | Connected using `quantity` | Live dedicated stock update passed |
| USD conversion and markup | Connected to pricing/rate APIs | Pricing boundary tests cover conversion and invalid inputs; manual rate entry is supported |
| Product photos, cover and remove | Connected to picker/upload and photo actions | Live two-photo upload, cover selection and removal passed |
| CJ variant import | Connected from product photo/variant panel | Requires configured CJ supplier; not executed against a real supplier |
| Order details and payment state | Connected | Authenticated live reads passed; payment metadata verified after deployment |
| COD receipt collection | Connected with reference and confirmation | Native eligibility tests and server guard tests; live ineligible request rejected; no real collection made |
| Order receipt and PDF | Connected | Live order/line-item read passed; PDF pagination device test is authored but has not run |
| Delivery and order progression | Connected with confirmation | Existing server transition/payment guard tests; no real order changed |
| Return approval/rejection/receipt/refund | Connected with confirmation | Existing server guard tests; no real refund submitted |
| Shipment recording and carrier refresh | Connected | Requires a real booked AWB; no carrier operation executed |
| Expenses and gift-card issuance | Connected | No real financial record issued during this audit |
| Settings/seller credential configuration | Connected, ADMIN only | Reads omit secret values; provider operations not executed |
| User role/activation changes | Connected, ADMIN only | Existing server admin-access guard tests; no account access changed |
| Other admin menu data | Rendered with pagination | All published menu read-handler tests pass |

This is not a claim of complete website parity. Supplier administration beyond the existing create form, full CJ sourcing/mapping/order tools, financial CSV export/date-filter controls, user creation/password/profile management and all supplier-screen edge cases still need dedicated native UI work or further device verification. Existing supplier screens were not comprehensively rewritten in this change.

## Build and device status

Android 1.1.0 debug APK built successfully. Kotlin workflow unit tests passed. Device UI/PDF tests could not start because the phone disconnected; the user chose to continue API checks. The APK has not been installed or verified on the phone in this turn.

## Verification limits

The previous deployment's 93 anonymous route checks only established route availability and authentication restrictions. They did not verify signed-in mutations or Android screens. This audit adds authenticated live workflow tests using the existing connected-device session, Kotlin payload/eligibility tests, backend guard tests and authored device UI/PDF tests. UI tests open forms and read records without submitting real customer changes.

Live mutations used a hidden category and a DRAFT product with unique QA identifiers. Those records and every test Cloudinary image were removed after verification. Audit entries remain as the record of those test operations. No existing customer order, payment, refund, supplier purchase or user account was altered.

## Running checks

Set `JAVA_HOME` to JDK 17 and point `ANDROID_HOME` (or ignored `local.properties`) to an Android SDK with API 35.

```powershell
cd android-admin
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest
.\gradlew.bat :app:connectedDebugAndroidTest
```

The menu UI tests require an already signed-in ADMIN/MANAGER session on the attached device and skip the signed-in checks if none exists. They never embed credentials. The PDF fixture test uses synthetic data. A successful API test alone is not evidence that every native screen has been exercised.
