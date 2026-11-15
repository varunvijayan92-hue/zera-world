# Mobile product form API

Authenticate with `POST /api/auth/login` using `portal: "APP"` and retain the session cookie. These endpoints require ADMIN or MANAGER. Native clients can omit Origin; browser clients must use the same origin where enforced.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/mobile/products/options` | Categories with parentId, supplier choices, statuses and photo limits |
| GET | `/api/mobile/products` | Product list |
| GET | `/api/mobile/products/{id}` | Editing details, extras, inventory and availableQty |
| POST | `/api/mobile/products` | Create using the website product payload |
| PATCH | `/api/mobile/products/{id}` | Update only changed product fields |
| DELETE | `/api/mobile/products/{id}` | Delete a product without linked history |
| GET | `/api/mobile/products/exchange-rate` | Latest available USD/INR rate (cached for one hour); 503 allows manual entry |
| POST | `/api/mobile/products/pricing` | Convert cost and calculate markup |
| POST | `/api/mobile/products/cj-variants` | Import CJ variants and mappings |
| POST | `/api/mobile/products/{id}/photos` | Upload multipart photos using repeated `files` fields |

Pricing JSON: `{"usdCost":4.49,"exchangeRate":85,"markupPercent":10}` returns `data.costPrice: 381.65` and `data.sellingPrice: 419.82`. Alternatively supply `costPrice` in INR instead of `usdCost`. Markup is a percentage of cost and excludes taxes and expenses. Calculations do not save prices; send calculated values in the create/update payload.

Create JSON example: `{"name":"Example","sku":"EX-001","categoryId":"category-id","supplierId":"supplier-id","costPrice":381.65,"sellingPrice":419.82,"availableQty":5,"status":"DRAFT"}`. Use the selected child category ID, or parent ID when no child is selected. Empty categoryId/supplierId clears selection. Optional website fields include description, specifications, manufacturerInfo, brand, size, color, warranty, trend, inTheBox, mrp, hsnCode, gstRate, deliveryCharge, handlingCharge, returnDays, isReturnable and codAvailable. Stock and images cannot be changed by PATCH; use existing inventory tools and the photo endpoint.

After creation, keep `data.id`, upload photos directly from the device, then optionally import CJ variants with `{"productId":"saved-id","cjProductId":"cj-id"}`. The product must have an active CJ supplier. CJ imports preserve selling prices, stock and photos. Read existing CJ mappings using `/api/admin/suppliers/cj-variant-sync/{productId}`.

Photo responses contain `data.id` and `data.imageUrls`. JPEG, PNG and WebP are supported, up to 5 MB each and six photos total. Batch upload failures clean up newly uploaded files. Creation, photo upload and CJ import are separate operations: retain the created ID and retry only the failed step to avoid duplicate products. A website visit is not required.

Errors return `message` and an HTTP error status. These endpoints supply backend support; native form wiring and device testing remain separate work.
