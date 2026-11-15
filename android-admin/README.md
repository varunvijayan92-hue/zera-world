# Zera's World Android Admin & Supplier Portal

For the complete mobile menu contracts, pagination, record details, workflow routes and Android connection examples, see [MENU_API.md](MENU_API.md). Product form endpoints are documented in [PRODUCT_API.md](PRODUCT_API.md).

A native Android application built with **Jetpack Compose** providing complete role-based management access for **Administrators**, **Managers**, and **Suppliers**. The app communicates natively with the Zera's World Next.js backend via authenticated REST APIs, sharing the identical database, business rules, and cloud storage infrastructure as the website.

---

## Key Capabilities

### 1. Unified Authentication & Role-Based Scoping
- **Unified Portal Login (`portal: "APP"`)**: Authenticates Admin, Manager, and Supplier credentials against `/api/auth/login`.
- **Session Management**: Native cookie jar securely maintains the backend session cookie (`supplierbridge_session` with fallback to `auth_session`).
- **Dynamic Navigation**: Loads server-defined navigation trees from `/api/mobile/navigation`:
  - **Admin**: All 22 management sections (Dashboard, Orders, Shipments, Returns, Products, Suppliers, Accounts/P&L, Categories, Inventory, Customers, Delivery Staff, Reviews, Abandoned Carts, Expenses, Support, Sync Logs, etc.).
  - **Supplier**: All 11 vendor sections (Dashboard, Orders, Notifications, Products, Shipments, Returns, Payments, Reports, Local Customers, Support, Pickup Address / Company Profile).

### 2. Cloud Storage (Cloudinary) & Database Linking
- **Direct Cloud Upload API (`/api/mobile/upload`)**: Uploads photos directly to Cloudinary (`zeraworld/products/{id}` or `zeraworld/categories/{id}`) via authenticated multipart streams.
- **Automatic Database Linking**: Secure Cloudinary URLs are instantly written to the PostgreSQL database via Prisma (`Product.imageUrls` or `StoreCategory.imageUrl`).
- **Native Photo Picker**: Integrated with Android's `ActivityResultContracts.GetContent()` for seamless photo selection from the device gallery or camera.
- **Coil Image Loading**: Rich image thumbnails rendered in Compose cards with `coil-compose`.

### 3. Real-Time Search & Filtering
- Persistent **Search Bar** across all section views allows instant filtering of orders, products, customers, suppliers, inventory, and support tickets by ID, name, SKU, or status.

### 4. Interactive Operations & Actions

#### Administrator Actions
- **Products**: Add new products, edit selling/cost prices, update stock, toggle status (Active/Draft), and upload product photos to Cloudinary.
- **Categories**: Create store categories (name, slug, description) and upload category banner images.
- **Inventory**: Real-time stock level adjustments and low stock tracking.
- **Orders & Fulfillment**: Advance order workflow (Confirmed, Processing, Shipped, Delivered), enter courier AWB, and record Cash on Delivery (COD) collections.
- **Returns**: Review customer return requests (Approve, Reject, Complete) with restocking fee notes.
- **Suppliers & Payouts**: Register direct suppliers (GSTIN, PAN, pickup address) and record settlement payout transactions.
- **Profit & Loss (P&L)**: Live financial breakdown card showing Gross Sales, COGS, Shipping, Operating Expenses, Refunds, GST liability, and Net Profit.
- **Expenses & Vouchers**: Record operating expense vouchers and issue customer store credits/vouchers.
- **Dropshipping**: Trigger background CJ Dropshipping product and order synchronization.
- **Users & Support**: Activate/deactivate accounts and reply to support inquiries.

#### Supplier Actions
- **Order Fulfillment**: Review assigned order lines, Accept, Pack, and dispatch with courier AWB tracking (Delhivery / Shiprocket).
- **Product Drafts**: Submit new product listings with suggested cost price, opening stock, HSN code, description, and Cloudinary photos for admin approval.
- **Catalog & Stock**: Update stock counts, cost prices, and HSN codes for assigned products.
- **Returns**: Confirm warehouse receipt of approved customer returns.
- **Local Customers**: Register and manage local customer contact lists.
- **Support Tickets**: Submit support inquiries directly to store administration.
- **Profile & Pickup**: Update contact details, pickup address lines, city, state, and pincode.

---

## Project Layout

```text
android-admin/
├── app/
│   ├── build.gradle.kts                     # App dependencies (Compose BOM, Coil, OkHttp, Firebase)
│   ├── google-services.json                 # Firebase configuration for in.zerasworld.admin
│   └── src/main/
│       ├── AndroidManifest.xml              # Permissions (INTERNET, POST_NOTIFICATIONS)
│       └── java/in/zerasworld/admin/
│           ├── MainActivity.kt              # Jetpack Compose UI (Navigation, Sections, Dialogs, Photo Picker)
│           ├── AdminApiRepository.kt        # OkHttp client, Cloudinary upload, API action dispatchers
│           ├── AdminSessionManager.kt       # Encrypted shared preferences & session persistence
│           ├── NotificationPermissionHelper.kt # Runtime notification permission handler
│           └── service/
│               └── MyFirebaseMessagingService.kt # Push notification handler
├── build.gradle.kts                         # Root Gradle build script
├── settings.gradle.kts                      # Gradle settings & repositories
└── README.md                                # Project documentation
```

---

## API Endpoints Reference

| Endpoint | Method | Auth Role | Description |
| :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public | Authenticates credentials with `portal: "APP"`. |
| `/api/mobile/navigation` | `GET` | Admin / Supplier | Returns role-specific navigation menu structure. |
| `/api/mobile/admin/{section}` | `GET` | Admin / Manager | Fetches data and metrics for any of the 22 admin sections. |
| `/api/mobile/admin/actions` | `POST` | Admin / Manager | Dispatches admin write operations. |
| `/api/mobile/supplier/{section}`| `GET` | Supplier | Fetches supplier-scoped data for any of the 11 vendor sections. |
| `/api/supplier/actions` | `POST` | Supplier | Dispatches supplier fulfillment, stock, draft, and profile actions. |
| `/api/mobile/upload` | `POST` | Admin / Supplier | Streams photo to Cloudinary & links URL to product/category in DB. |
| `/api/admin/device-token` | `POST` | Admin / Supplier | Registers FCM device tokens for push alerts. |

---

## Development Setup & Running

1. **Prerequisites**:
   - Android Studio (Ladybug / Iguana or later).
   - JDK 17.
   - Android SDK 35 (Android 15) with `minSdk` 26 (Android 8.0).
2. **Open Project**:
   - Open the `android-admin` folder directly in Android Studio.
   - Allow Gradle to sync dependencies.
3. **Configure Backend URL**:
   - When launching on an **Android Emulator**, use `http://10.0.2.2:3000` to reach the local Next.js dev server running on your host machine.
   - When running on a **Physical Device**, enter your computer's LAN IP (e.g. `http://192.168.1.5:3000`) or your live production domain (e.g. `https://zerasworld.in`).
4. **Run Application**:
   - Select your target device or emulator in Android Studio and click **Run (Shift+F10)**.
