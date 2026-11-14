package `in`.zerasworld.admin

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

data class AdminOrder(
    val id: String,
    val marketplaceOrderId: String,
    val customerName: String,
    val status: String,
    val totalAmount: Double,
    val itemsCount: Int,
    val createdAt: String,
    val items: List<AdminOrderItem> = emptyList()
)

data class AdminOrderItem(
    val id: String,
    val productId: String?,
    val sku: String?,
    val quantity: Int,
    val unitPrice: Double,
    val fulfillmentStatus: String,
    val supplierId: String?
)

data class AdminProduct(
    val id: String,
    val name: String,
    val sku: String,
    val category: String,
    val status: String,
    val sellingPrice: Double,
    val costPrice: Double,
    val availableQty: Int,
    val supplierName: String
)

data class AdminSupplier(
    val id: String,
    val companyName: String,
    val contactName: String,
    val email: String,
    val phone: String,
    val status: String,
    val sourceType: String
)

data class AdminReturn(
    val id: String,
    val customerOrderId: String,
    val reason: String,
    val status: String,
    val refundAmount: Double,
    val supplierReceived: Boolean,
    val createdAt: String
)

data class NavItem(
    val id: String,
    val label: String
)

data class NavGroup(
    val label: String,
    val items: List<NavItem>
)

data class NavResponse(
    val role: String,
    val groups: List<NavGroup>
)

data class SupplierDashboardMetrics(
    val orderLines: Int = 0,
    val products: Int = 0,
    val shipments: Int = 0,
    val returns: Int = 0
)

data class SupplierShipmentItem(
    val id: String,
    val trackingNumber: String,
    val courierName: String,
    val status: String,
    val orderId: String,
    val latestEvent: String
)

data class SupplierSettlementItem(
    val id: String,
    val amount: Double,
    val paidAt: String,
    val reference: String,
    val notes: String
)

data class SupplierLocalCustomerItem(
    val id: String,
    val name: String,
    val phone: String,
    val email: String,
    val address: String
)

data class SupplierSupportItem(
    val id: String,
    val subject: String,
    val message: String,
    val status: String,
    val reply: String
)

sealed class ApiResult<out T> {
    data class Success<out T>(val data: T) : ApiResult<T>()
    data class Error(val message: String) : ApiResult<Nothing>()
}

class AdminApiRepository(private val sessionManager: AdminSessionManager) {

    private val sessionOrigin get() = okhttp3.HttpUrl.Companion.run { sessionManager.baseUrl.toHttpUrl() }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor { chain ->
                if (!chain.request().url.isHttps) throw java.io.IOException("Use an HTTPS server URL.")
                chain.proceed(chain.request())
            }
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .cookieJar(object : CookieJar {
                override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                    if (url.scheme != sessionOrigin.scheme || url.host != sessionOrigin.host || url.port != sessionOrigin.port) return
                    cookies.firstOrNull { it.name == "supplierbridge_session" }?.let { sessionCookie ->
                        sessionManager.authToken = if (sessionCookie.expiresAt > System.currentTimeMillis()) sessionCookie.toString() else null
                    }
                }

                override fun loadForRequest(url: HttpUrl): List<Cookie> {
                    if (!url.isHttps || url.host != sessionOrigin.host || url.port != sessionOrigin.port) return emptyList()
                    val savedCookie = sessionManager.authToken ?: return emptyList()
                    val cookie = Cookie.parse(sessionOrigin, savedCookie) ?: return emptyList()
                    return if (cookie.name == "supplierbridge_session" && cookie.matches(url) && cookie.expiresAt > System.currentTimeMillis()) listOf(cookie) else emptyList()
                }
            })
            .build()
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun login(portal: String, loginId: String, password: String): ApiResult<UserSession> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/auth/login"
            val bodyObj = JSONObject().apply {
                put("portal", portal) // ADMIN or SUPPLIER
                put("loginId", loginId.trim())
                put("password", password)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .header("X-Requested-With", "XMLHttpRequest")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val json = JSONObject(responseStr)
                    val userObj = json.getJSONObject("user")
                    val user = UserSession(
                        id = userObj.getString("id"),
                        fullName = userObj.optString("fullName", "User"),
                        email = userObj.optString("email", ""),
                        role = userObj.optString("role", portal),
                        supplierId = userObj.optString("supplierId", null),
                        supplierName = userObj.optString("supplierName", null)
                    )
                    sessionManager.saveUser(user)
                    ApiResult.Success(user)
                } else {
                    val msg = try {
                        JSONObject(responseStr).optString("message", "Login failed (HTTP ${response.code})")
                    } catch (_: Exception) {
                        "Login failed with status code ${response.code}"
                    }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Network connection error.")
        }
    }

    suspend fun registerDeviceToken(fcmToken: String): ApiResult<Boolean> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/device-token"
            val user = sessionManager.getUser()
            val bodyObj = JSONObject().apply {
                put("fcmToken", fcmToken)
                put("userId", user?.id ?: "")
                put("role", user?.role ?: "ADMIN")
                put("platform", "ANDROID")
                put("deviceModel", "${Build.MANUFACTURER} ${Build.MODEL}")
                put("sdkVersion", Build.VERSION.SDK_INT)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    sessionManager.fcmToken = fcmToken
                    sessionManager.isTokenRegistered = true
                    ApiResult.Success(true)
                } else {
                    ApiResult.Error("Device registration failed (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to register device token.")
        }
    }

    suspend fun fetchOrders(): ApiResult<List<AdminOrder>> = withContext(Dispatchers.IO) {
        try {
            val primaryUrl = "${sessionManager.baseUrl}/api/mobile/admin/orders"
            var responseStr = ""
            var isSuccessful = false

            val request1 = Request.Builder().url(primaryUrl).get().build()
            client.newCall(request1).execute().use { resp ->
                if (resp.isSuccessful) {
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = true
                }
            }

            if (!isSuccessful) {
                val fallbackUrl = "${sessionManager.baseUrl}/api/orders"
                val request2 = Request.Builder().url(fallbackUrl).get().build()
                client.newCall(request2).execute().use { resp ->
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = resp.isSuccessful
                }
            }

            if (isSuccessful && responseStr.isNotBlank()) {
                val orders = mutableListOf<AdminOrder>()
                val jsonArray = try {
                    val root = JSONObject(responseStr)
                    root.optJSONArray("data") ?: root.optJSONArray("orders") ?: JSONArray()
                } catch (_: Exception) {
                    try { JSONArray(responseStr) } catch (_: Exception) { JSONArray() }
                }

                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val itemsArray = obj.optJSONArray("orderItems") ?: obj.optJSONArray("items")
                    val itemsList = mutableListOf<AdminOrderItem>()
                    if (itemsArray != null) {
                        for (j in 0 until itemsArray.length()) {
                            val itemObj = itemsArray.getJSONObject(j)
                            itemsList.add(
                                AdminOrderItem(
                                    id = itemObj.optString("id", ""),
                                    productId = itemObj.optString("productId", null),
                                    sku = itemObj.optString("marketplaceSku", null),
                                    quantity = itemObj.optInt("quantity", 1),
                                    unitPrice = itemObj.optDouble("unitPrice", 0.0),
                                    fulfillmentStatus = itemObj.optString("fulfillmentStatus", "PENDING"),
                                    supplierId = itemObj.optString("supplierId", null)
                                )
                            )
                        }
                    }
                    orders.add(
                        AdminOrder(
                            id = obj.optString("id", ""),
                            marketplaceOrderId = obj.optString("marketplaceOrderId", "N/A"),
                            customerName = obj.optString("customerName", "Guest Customer"),
                            status = obj.optString("status", "PENDING"),
                            totalAmount = obj.optDouble("totalAmount", 0.0),
                            itemsCount = itemsList.size,
                            createdAt = obj.optString("createdAt", ""),
                            items = itemsList
                        )
                    )
                }
                ApiResult.Success(orders)
            } else {
                ApiResult.Error("Failed to load orders.")
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading orders.")
        }
    }

    suspend fun fetchProducts(): ApiResult<List<AdminProduct>> = withContext(Dispatchers.IO) {
        try {
            val primaryUrl = "${sessionManager.baseUrl}/api/mobile/admin/products"
            var responseStr = ""
            var isSuccessful = false

            val request1 = Request.Builder().url(primaryUrl).get().build()
            client.newCall(request1).execute().use { resp ->
                if (resp.isSuccessful) {
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = true
                }
            }

            if (!isSuccessful) {
                val fallbackUrl = "${sessionManager.baseUrl}/api/products"
                val request2 = Request.Builder().url(fallbackUrl).get().build()
                client.newCall(request2).execute().use { resp ->
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = resp.isSuccessful
                }
            }

            if (isSuccessful && responseStr.isNotBlank()) {
                val products = mutableListOf<AdminProduct>()
                val jsonArray = try {
                    val root = JSONObject(responseStr)
                    root.optJSONArray("data") ?: root.optJSONArray("products") ?: JSONArray()
                } catch (_: Exception) {
                    try { JSONArray(responseStr) } catch (_: Exception) { JSONArray() }
                }

                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    val supplierObj = obj.optJSONObject("supplier")
                    val supplierName = supplierObj?.optString("companyName") ?: "Zera's World Direct"

                    var qty = obj.optInt("availableQty", -1)
                    if (qty < 0) qty = obj.optInt("stock", -1)
                    if (qty < 0) {
                        val invArr = obj.optJSONArray("inventory")
                        if (invArr != null && invArr.length() > 0) {
                            qty = invArr.optJSONObject(0)?.optInt("availableQty", 0) ?: 0
                        } else {
                            val invObj = obj.optJSONObject("inventory")
                            qty = invObj?.optInt("availableQty", 0) ?: 0
                        }
                    }
                    if (qty < 0) qty = 0

                    products.add(
                        AdminProduct(
                            id = obj.optString("id", ""),
                            name = obj.optString("name", "Product"),
                            sku = obj.optString("sku", "SKU-N/A"),
                            category = obj.optString("category", "General"),
                            status = obj.optString("status", "DRAFT"),
                            sellingPrice = obj.optDouble("sellingPrice", 0.0),
                            costPrice = obj.optDouble("costPrice", 0.0),
                            availableQty = qty,
                            supplierName = supplierName
                        )
                    )
                }
                ApiResult.Success(products)
            } else {
                ApiResult.Error("Failed to load products.")
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading products.")
        }
    }

    suspend fun fetchSuppliers(): ApiResult<List<AdminSupplier>> = withContext(Dispatchers.IO) {
        try {
            val primaryUrl = "${sessionManager.baseUrl}/api/mobile/admin/suppliers"
            var responseStr = ""
            var isSuccessful = false

            val request1 = Request.Builder().url(primaryUrl).get().build()
            client.newCall(request1).execute().use { resp ->
                if (resp.isSuccessful) {
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = true
                }
            }

            if (!isSuccessful) {
                val fallbackUrl = "${sessionManager.baseUrl}/api/suppliers"
                val request2 = Request.Builder().url(fallbackUrl).get().build()
                client.newCall(request2).execute().use { resp ->
                    responseStr = resp.body?.string() ?: ""
                    isSuccessful = resp.isSuccessful
                }
            }

            if (isSuccessful && responseStr.isNotBlank()) {
                val suppliers = mutableListOf<AdminSupplier>()
                val jsonArray = try {
                    val root = JSONObject(responseStr)
                    root.optJSONArray("data") ?: root.optJSONArray("suppliers") ?: JSONArray()
                } catch (_: Exception) {
                    try { JSONArray(responseStr) } catch (_: Exception) { JSONArray() }
                }

                for (i in 0 until jsonArray.length()) {
                    val obj = jsonArray.getJSONObject(i)
                    suppliers.add(
                        AdminSupplier(
                            id = obj.optString("id", ""),
                            companyName = obj.optString("companyName", "Supplier"),
                            contactName = obj.optString("contactName", ""),
                            email = obj.optString("email", ""),
                            phone = obj.optString("phone", ""),
                            status = obj.optString("status", "ACTIVE"),
                            sourceType = obj.optString("sourceType", "DIRECT")
                        )
                    )
                }
                ApiResult.Success(suppliers)
            } else {
                ApiResult.Error("Failed to load suppliers.")
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading suppliers.")
        }
    }

    suspend fun fetchReturns(): ApiResult<List<AdminReturn>> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/returns"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val returnsList = mutableListOf<AdminReturn>()
                    val root = try { JSONObject(responseStr) } catch (_: Exception) { null }
                    val jsonArray = root?.optJSONArray("data") ?: JSONArray(responseStr)
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        returnsList.add(
                            AdminReturn(
                                id = obj.optString("id", ""),
                                customerOrderId = obj.optString("customerOrderId", ""),
                                reason = obj.optString("reason", "Customer return"),
                                status = obj.optString("status", "OPEN"),
                                refundAmount = obj.optDouble("refundAmount", 0.0),
                                supplierReceived = !obj.isNull("supplierReceivedAt"),
                                createdAt = obj.optString("createdAt", "")
                            )
                        )
                    }
                    ApiResult.Success(returnsList)
                } else {
                    ApiResult.Error("Failed to load returns (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading returns.")
        }
    }

    suspend fun updateSupplierOrderFulfillment(itemId: String, status: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "ORDER")
                put("itemId", itemId)
                put("status", status) // ACCEPTED, REJECTED, PROCESSING, PACKED
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Order item status updated.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Update failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to update item status.")
        }
    }

    suspend fun submitSupplierShipmentAWB(itemId: String, awb: String, courierName: String = "Delhivery"): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "SHIPMENT")
                put("itemId", itemId)
                put("courierName", courierName)
                put("awb", awb)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Shipment AWB recorded.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Shipment submission failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to submit AWB.")
        }
    }

    suspend fun confirmSupplierReturnReceived(returnId: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "RETURN_RECEIVED")
                put("returnId", returnId)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Return receipt confirmed.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Action failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to confirm return.")
        }
    }

    suspend fun updateSupplierProductStock(productId: String, stock: Int, costPrice: Double, hsnCode: String?): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "STOCK")
                put("productId", productId)
                put("stock", stock)
                put("costPrice", costPrice)
                if (!hsnCode.isNullOrBlank()) put("hsnCode", hsnCode)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Stock updated successfully.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Update failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to update stock.")
        }
    }

    suspend fun submitSupplierProduct(name: String, sku: String, description: String, hsnCode: String?, costPrice: Double, stock: Int): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "PRODUCT")
                put("name", name.trim())
                put("sku", sku.trim())
                put("description", description.trim())
                if (!hsnCode.isNullOrBlank()) put("hsnCode", hsnCode.trim())
                put("costPrice", costPrice)
                put("stock", stock)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Product submitted as draft for approval.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Submission failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to submit product.")
        }
    }

    suspend fun saveSupplierProfile(fields: Map<String, Any?>): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val bodyObj = JSONObject().apply {
                put("action", "PROFILE")
                fields.forEach { (k, v) -> if (v != null) put(k, v) }
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Profile updated successfully.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Update failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to save profile.")
        }
    }

    suspend fun confirmAdminOrderDelivery(orderId: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/orders/$orderId/delivery"
            val request = Request.Builder()
                .url(url)
                .post("{}".toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Delivery confirmed.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Confirmation failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to confirm delivery.")
        }
    }

    suspend fun deleteAdminPendingOrder(orderId: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/orders/$orderId/delete"
            val request = Request.Builder()
                .url(url)
                .post("{}".toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Order deleted.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Deletion failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to delete order.")
        }
    }

    suspend fun processAdminReturnRefund(returnId: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/returns/$returnId/refund"
            val request = Request.Builder()
                .url(url)
                .post("{}".toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Refund processed successfully.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Refund failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to process refund.")
        }
    }

    suspend fun updateAdminProductStock(productId: String, availableQty: Int): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/products/$productId/stock"
            val bodyObj = JSONObject().apply {
                put("availableQty", availableQty)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Product stock updated.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Stock update failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to update product stock.")
        }
    }

    suspend fun createAdminProduct(
        name: String,
        sku: String,
        sellingPrice: Double,
        costPrice: Double = 0.0,
        mrp: Double? = null,
        stock: Int = 0,
        category: String? = null,
        brand: String? = null,
        size: String? = null,
        color: String? = null,
        description: String? = null,
        hsnCode: String? = null,
        deliveryCharge: Double? = null,
        status: String = "ACTIVE",
        supplierId: String? = null,
        imageUrls: List<String> = emptyList()
    ): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val bodyObj = JSONObject().apply {
                put("action", "PRODUCT_CREATE")
                put("name", name)
                put("sku", sku)
                put("sellingPrice", sellingPrice)
                put("costPrice", costPrice)
                if (mrp != null && mrp > 0) put("mrp", mrp)
                put("stock", stock)
                if (!category.isNullOrBlank()) put("category", category)
                if (!brand.isNullOrBlank()) put("brand", brand)
                if (!size.isNullOrBlank()) put("size", size)
                if (!color.isNullOrBlank()) put("color", color)
                if (!description.isNullOrBlank()) put("description", description)
                if (!hsnCode.isNullOrBlank()) put("hsnCode", hsnCode)
                if (deliveryCharge != null && deliveryCharge >= 0) put("deliveryCharge", deliveryCharge)
                put("status", status)
                if (!supplierId.isNullOrBlank()) put("supplierId", supplierId)
                if (imageUrls.isNotEmpty()) {
                    val arr = JSONArray()
                    imageUrls.forEach { arr.put(it) }
                    put("imageUrls", arr)
                }
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = try { JSONObject(responseStr).optString("message", "Product created successfully.") } catch (_: Exception) { "Product created successfully." }
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Failed to create product (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to create product.")
        }
    }

    suspend fun createAdminSupplier(
        companyName: String,
        contactName: String?,
        email: String?,
        phone: String?,
        sourceType: String = "DIRECT",
        pickupAddress: String? = null,
        pickupCity: String? = null,
        pickupState: String? = null,
        gstNumber: String? = null
    ): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val bodyObj = JSONObject().apply {
                put("action", "SUPPLIER_CREATE")
                put("companyName", companyName)
                if (!contactName.isNullOrBlank()) put("contactName", contactName)
                if (!email.isNullOrBlank()) put("email", email)
                if (!phone.isNullOrBlank()) put("phone", phone)
                put("sourceType", sourceType)
                if (!pickupAddress.isNullOrBlank()) put("pickupAddress", pickupAddress)
                if (!pickupCity.isNullOrBlank()) put("pickupCity", pickupCity)
                if (!pickupState.isNullOrBlank()) put("pickupState", pickupState)
                if (!gstNumber.isNullOrBlank()) put("gstNumber", gstNumber)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = try { JSONObject(responseStr).optString("message", "Supplier created successfully.") } catch (_: Exception) { "Supplier created successfully." }
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Failed to create supplier (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to create supplier.")
        }
    }

    suspend fun createAdminExpense(category: String, amount: Double, description: String?): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val bodyObj = JSONObject().apply {
                put("action", "EXPENSE_CREATE")
                put("category", category)
                put("amount", amount)
                if (!description.isNullOrBlank()) put("description", description)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = try { JSONObject(responseStr).optString("message", "Expense recorded.") } catch (_: Exception) { "Expense recorded." }
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Failed to record expense." }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to record expense.")
        }
    }

    suspend fun createSupplierSettlement(supplierId: String, amount: Double, reference: String, notes: String? = null): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val bodyObj = JSONObject().apply {
                put("action", "SUPPLIER_SETTLEMENT")
                put("supplierId", supplierId)
                put("amount", amount)
                put("reference", reference)
                if (!notes.isNullOrBlank()) put("notes", notes)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = try { JSONObject(responseStr).optString("message", "Settlement recorded.") } catch (_: Exception) { "Settlement recorded." }
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Failed to record settlement." }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to record settlement.")
        }
    }

    suspend fun replySupportTicket(ticketId: String, reply: String, status: String = "RESOLVED"): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val bodyObj = JSONObject().apply {
                put("action", "SUPPORT_REPLY")
                put("ticketId", ticketId)
                put("reply", reply)
                put("status", status)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = try { JSONObject(responseStr).optString("message", "Reply sent.") } catch (_: Exception) { "Reply sent." }
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Failed to send reply." }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to send reply.")
        }
    }

    suspend fun sendTestAlert(alertType: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/admin/device-token/test-alert"
            val fcmToken = sessionManager.fcmToken ?: ""
            val bodyObj = JSONObject().apply {
                put("alertType", alertType)
                put("fcmToken", fcmToken)
            }
            val request = Request.Builder()
                .url(url)
                .post(bodyObj.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val json = JSONObject(responseStr)
                    val message = json.optString("message", "Test alert dispatched successfully.")
                    ApiResult.Success(message)
                } else {
                    ApiResult.Error("Failed to trigger alert (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to send test alert.")
        }
    }

    suspend fun fetchNavigation(): ApiResult<NavResponse> = withContext(Dispatchers.IO) {
        val userRole = sessionManager.getUser()?.role ?: "ADMIN"
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/navigation"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val json = JSONObject(responseStr)
                    val role = json.optString("role", userRole)
                    val groupsArr = json.optJSONArray("groups") ?: JSONArray()
                    val groupsList = mutableListOf<NavGroup>()
                    for (i in 0 until groupsArr.length()) {
                        val gObj = groupsArr.getJSONObject(i)
                        val gLabel = gObj.optString("label", "Section")
                        val itemsArr = gObj.optJSONArray("items") ?: JSONArray()
                        val itemsList = mutableListOf<NavItem>()
                        for (j in 0 until itemsArr.length()) {
                            val iObj = itemsArr.getJSONObject(j)
                            itemsList.add(NavItem(iObj.optString("id"), iObj.optString("label")))
                        }
                        groupsList.add(NavGroup(gLabel, itemsList))
                    }
                    if (groupsList.isNotEmpty()) {
                        ApiResult.Success(NavResponse(role, groupsList))
                    } else {
                        ApiResult.Success(getDefaultNavigation(userRole))
                    }
                } else {
                    ApiResult.Success(getDefaultNavigation(userRole))
                }
            }
        } catch (_: Exception) {
            ApiResult.Success(getDefaultNavigation(userRole))
        }
    }

    fun getDefaultNavigation(role: String): NavResponse {
        return if (role.equals("SUPPLIER", ignoreCase = true)) {
            NavResponse(
                role = "SUPPLIER",
                groups = listOf(
                    NavGroup("Overview", listOf(
                        NavItem("dashboard", "Dashboard"),
                        NavItem("orders", "Orders"),
                        NavItem("products", "Products & Inventory"),
                        NavItem("local-customers", "Local customers")
                    )),
                    NavGroup("Fulfilment", listOf(
                        NavItem("shipments", "Shipments & Tracking"),
                        NavItem("returns", "Returns & RTO")
                    )),
                    NavGroup("Business", listOf(
                        NavItem("payments", "Payments & Settlements"),
                        NavItem("reports", "Reports")
                    )),
                    NavGroup("Account", listOf(
                        NavItem("notifications", "Notifications"),
                        NavItem("profile", "Contact & Settings"),
                        NavItem("pickup-address", "Pickup / Local Address"),
                        NavItem("company-profile", "Company Profile"),
                        NavItem("support", "Support")
                    ))
                )
            )
        } else {
            NavResponse(
                role = "ADMIN",
                groups = listOf(
                    NavGroup("Overview", listOf(
                        NavItem("dashboard", "Dashboard"),
                        NavItem("analytics", "Analytics")
                    )),
                    NavGroup("Commerce", listOf(
                        NavItem("products", "Products"),
                        NavItem("orders", "Orders"),
                        NavItem("notifications", "Notifications"),
                        NavItem("contact-messages", "Contact requests"),
                        NavItem("customers", "Customers"),
                        NavItem("inventory", "Inventory"),
                        NavItem("returns", "Returns & RTO"),
                        NavItem("sellers", "Seller channels"),
                        NavItem("categories", "Categories")
                    )),
                    NavGroup("Dropshipping", listOf(
                        NavItem("suppliers", "Suppliers"),
                        NavItem("fulfillment", "Fulfillment"),
                        NavItem("product-sync", "Product Sync"),
                        NavItem("tracking", "Tracking")
                    )),
                    NavGroup("Finance", listOf(
                        NavItem("accounts", "Accounts"),
                        NavItem("gift-cards", "Gift cards"),
                        NavItem("payments", "Payments"),
                        NavItem("invoices", "Invoices"),
                        NavItem("profit-expenses", "Profit & Expenses")
                    )),
                    NavGroup("System", listOf(
                        NavItem("settings", "Settings"),
                        NavItem("users", "Users & Roles")
                    ))
                )
            )
        }
    }

    suspend fun fetchAdminSection(section: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/$section"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    ApiResult.Success(responseStr)
                } else {
                    ApiResult.Error("HTTP ${response.code}: $responseStr")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to load section $section")
        }
    }

    suspend fun fetchSupplierSection(section: String): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/supplier/$section"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    ApiResult.Success(responseStr)
                } else {
                    ApiResult.Error("HTTP ${response.code}: $responseStr")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to load section $section")
        }
    }

    suspend fun uploadPhoto(
        fileBytes: ByteArray,
        fileName: String = "photo.jpg",
        mimeType: String = "image/jpeg",
        kind: String = "products",
        productId: String? = null,
        categoryId: String? = null
    ): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/upload"
            val bodyBuilder = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart(
                    "file",
                    fileName,
                    fileBytes.toRequestBody(mimeType.toMediaTypeOrNull())
                )
                .addFormDataPart("kind", kind)

            if (!productId.isNullOrBlank()) {
                bodyBuilder.addFormDataPart("productId", productId)
            }
            if (!categoryId.isNullOrBlank()) {
                bodyBuilder.addFormDataPart("categoryId", categoryId)
            }

            val request = Request.Builder()
                .url(url)
                .post(bodyBuilder.build())
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val json = JSONObject(responseStr)
                    val imageUrl = json.optString("url", "")
                    val msg = json.optString("message", "Photo uploaded to cloud storage and linked successfully.")
                    ApiResult.Success(imageUrl.ifBlank { msg })
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Upload failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to upload photo.")
        }
    }
}

