# Store admin, menu categories and Cloudinary photos

## Open the admin

Run `npm run dev`, then open `http://localhost:3000/admin/login`. Sign in with an existing active ADMIN or MANAGER account. The content tools are:

- `/admin/products`: create/edit products, assign categories, publish drafts and manage Cloudinary photos.
- `/admin/categories`: create/edit categories, reorder the menu, and show or hide menu entries.
- `/admin`: redirects to the Dashboard. The full sidebar is restored with Overview, Commerce, Dropshipping, Finance and System sections.

The configured database already had an admin account; it was preserved. No default password is shown in the UI or embedded in the setup script.

To create a new administrator, configure `ADMIN_EMAIL` and a password of at least 12 characters in the ignored local `.env`, then run:

```powershell
npm run db:seed:admin
```

An existing account's password is unchanged unless you explicitly run:

```powershell
npm run db:seed:admin -- --reset-password
```

Use the intended existing administrator's email for a reset. Store admin authentication requires a `JWT_SECRET` of at least 32 characters. A valid local session secret has been configured.

## Create menu categories

1. Open Menu categories.
2. Enter a name, URL slug and optional introduction. The slug is filled from the name for a new category and remains editable.
3. Choose Show in website menu and save. Visible categories immediately become links on the home and product listing pages.
4. Use the up/down controls to change the menu order. Edit a category to rename it or hide its menu link.
5. Assign products to it in Products & photos. Clicking a category on the website shows its active products and introduction.

The starting categories are Home, Wellness, Kitchen, Travel, Workspace, Gift Edit and New In. Names, visibility and order are database-backed, not hardcoded into the storefront. Hiding a menu entry does not unpublish its products. A category with assigned products cannot be deleted until those products are moved or uncategorized. Renaming a category keeps product assignments intact.

## Add a product and photos

1. Open Products & photos and select Add a new product, or choose an existing product. Search by name or SKU if needed; the selector shows the first 100 matching products.
2. Enter product details, choose the menu category, set the selling price and opening stock, then save. Draft is the default status.
3. Choose JPEG, PNG or WebP files and click Upload to Cloudinary. Up to six photos can be attached to a product, with a 5 MB limit per photo.
4. Use as main photo changes the first image used on storefront cards. All product photos are available in the clickable product gallery.
5. Set status to Active and save when ready to publish. Use View product on website to open the actual page. Active products with a positive price and available stock can proceed through checkout.

Uploads are authenticated on the server, sent through the Cloudinary Node SDK and attached to `Product.imageUrls` in PostgreSQL. The website uses the saved versioned URLs through `CldImage` with automatic quality/format optimization. Legacy external image URLs remain supported. No unsigned upload preset is required. Removing a photo unlinks it from the product but retains the original in your Cloudinary Media Library. New files are cleaned up on a failed batch or failed database attachment where Cloudinary is reachable.

Opening stock can be set during product creation. Existing stock remains managed through the existing inventory integration/API. Live supplier imports are a separate pending integration.

## Environment and database

The supplied account has been configured locally using:

```dotenv
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=CLOUD_NAME
```

The private URL and API secret stay on the server and are stored only in the ignored `.env`. The public cloud name can be included in browser code. Do not concatenate multiple `CLOUDINARY_URL` assignments into one value. Deployment environment values must be configured separately.

`cloudinary` and `next-cloudinary` v6 are installed; v6 supports this project's Next.js 15 version. Photos reuse the existing product image URL array. Menu administration adds `StoreCategory` and the optional `Product.categoryId` relation while retaining the legacy category name for supplier compatibility.

The configured database was updated and the seven starting categories were seeded. For another deployment database:

```powershell
npm run db:push
npm run db:seed:categories
```

The category seed preserves an existing configured menu and links legacy category names where possible. It does not reset an edited menu. Back up a deployment database before changing its schema.

Server uploads must fit the request limits of the hosting provider as well as the application limits. On a host with a lower request-body limit, use smaller batches/files or adapt the upload transport before accepting larger uploads.

## Verification

Cloudinary authentication, upload and CDN delivery were tested against the supplied account. HTTP tests covered role protection, product/category creation, photo uploads, optimized delivery, cover changes, unlinking, invalid file rejection, category rename/visibility and prevention of deleting assigned categories. Temporary test products, categories, accounts and Cloudinary assets were cleaned up.

Browser checks also passed for admin sign-in, menu creation/reordering, product category assignment, draft-to-active publishing, Cloudinary upload/cover selection, storefront category navigation, gallery thumbnails and mobile layout.

## Full admin sidebar

All 16 requested menu entries have protected pages:

| Group | Pages |
| --- | --- |
| Overview | Dashboard, Analytics |
| Commerce | Products, Orders, Customers, Inventory, Categories |
| Dropshipping | Suppliers, Fulfillment, Product Sync, Tracking |
| Finance | Payments, Invoices, Profit & Expenses |
| System | Settings, Users & Roles |

Dashboard, analytics, orders, payment history, fulfillment records, sync records and tracking read the existing database. Customers are grouped from guest checkout contact details, not fabricated customer accounts. Inventory supports version-checked edits to AVAILABLE stock. Suppliers can be added as records; expenses can be recorded. ADMIN users can create internal accounts, change roles and deactivate other accounts. MANAGER users cannot administer users. Self-demotion/deactivation and removing the last active administrator are blocked.

Invoices currently provides printable order receipts; separately numbered tax invoices and business invoicing details are not configured. Settings is a read-only configuration summary that never displays private secrets. Live supplier purchasing, marketplace synchronization and carrier tracking still require actual provider connectors. These pages label those limits instead of reporting a fake connection.

The sidebar highlights the current section and opens as a keyboard-accessible drawer on mobile. Existing `/dashboard` bookmarks redirect to the matching `/admin` pages. Admin login now opens `/admin/dashboard`.

Browser checks passed for all 16 sections, stock changes and stale-write rejection, supplier/expense creation, staff role changes, administrator protections, receipt printing and the mobile drawer. No external supplier purchase or payment was initiated by these checks. Temporary test records were removed.

Run `npm test` and `npm run build` for local checks. No production deployment was performed.

References: https://next.cloudinary.dev/cldimage/basic-usage and https://cloudinary.com/documentation/node_image_and_video_upload
