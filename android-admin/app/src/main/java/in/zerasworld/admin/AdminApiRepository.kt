package `in`.zerasworld.admin

import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
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

sealed class ApiResult<out T> {
    data class Success<out T>(val data: T) : ApiResult<T>()
    data class Error(val message: String) : ApiResult<Nothing>()
}

data class NavigationItem(
    val id: String,
    val label: String
)

data class NavigationGroup(
    val label: String,
    val items: List<NavigationItem>
)

data class NavigationResponse(
    val role: String,
    val groups: List<NavigationGroup>
)

class AdminApiRepository(private val sessionManager: AdminSessionManager) {

    private val cookieStore = mutableMapOf<String, List<Cookie>>()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .cookieJar(object : CookieJar {
                override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
                    cookieStore[url.host] = cookies
                    cookies.firstOrNull { it.name == "supplierbridge_session" || it.name == "auth_session" }?.let { sessionCookie ->
                        sessionManager.authToken = sessionCookie.value
                    }
                }

                override fun loadForRequest(url: HttpUrl): List<Cookie> {
                    val savedToken = sessionManager.authToken
                    if (!savedToken.isNullOrEmpty()) {
                        return listOf(
                            Cookie.Builder()
                                .domain(url.host)
                                .path("/")
                                .name("supplierbridge_session")
                                .value(savedToken)
                                .httpOnly()
                                .build()
                        )
                    }
                    return cookieStore[url.host] ?: emptyList()
                }
            })
            .build()
    }

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    suspend fun login(portal: String = "APP", loginId: String, password: String): ApiResult<UserSession> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/auth/login"
            val bodyObj = JSONObject().apply {
                put("portal", portal) // ADMIN, SUPPLIER, or APP
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
            val url = "${sessionManager.baseUrl}/api/orders"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val orders = mutableListOf<AdminOrder>()
                    val root = JSONObject(responseStr)
                    val jsonArray = root.optJSONArray("data") ?: JSONArray(responseStr)
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        val itemsArray = obj.optJSONArray("orderItems")
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
                    ApiResult.Error("Failed to load orders (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading orders.")
        }
    }

    suspend fun fetchProducts(): ApiResult<List<AdminProduct>> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/products"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val products = mutableListOf<AdminProduct>()
                    val root = JSONObject(responseStr)
                    val jsonArray = root.optJSONArray("data") ?: JSONArray(responseStr)
                    for (i in 0 until jsonArray.length()) {
                        val obj = jsonArray.getJSONObject(i)
                        val supplierObj = obj.optJSONObject("supplier")
                        val supplierName = supplierObj?.optString("companyName") ?: "Zera's World Direct"
                        products.add(
                            AdminProduct(
                                id = obj.optString("id", ""),
                                name = obj.optString("name", "Product"),
                                sku = obj.optString("sku", "SKU-N/A"),
                                category = obj.optString("category", "General"),
                                status = obj.optString("status", "DRAFT"),
                                sellingPrice = obj.optDouble("sellingPrice", 0.0),
                                costPrice = obj.optDouble("costPrice", 0.0),
                                availableQty = obj.optInt("availableQty", 0),
                                supplierName = supplierName
                            )
                        )
                    }
                    ApiResult.Success(products)
                } else {
                    ApiResult.Error("Failed to load products (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Error loading products.")
        }
    }

    suspend fun fetchSuppliers(): ApiResult<List<AdminSupplier>> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/suppliers"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val suppliers = mutableListOf<AdminSupplier>()
                    val root = JSONObject(responseStr)
                    val jsonArray = root.optJSONArray("data") ?: JSONArray(responseStr)
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
                    ApiResult.Error("Failed to load suppliers (HTTP ${response.code})")
                }
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

    suspend fun login(loginId: String, password: String): ApiResult<UserSession> = login("APP", loginId, password)

    suspend fun fetchNavigation(): ApiResult<NavigationResponse> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/navigation"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val root = JSONObject(responseStr)
                    val role = root.optString("role", "")
                    val groupsArray = root.optJSONArray("groups") ?: JSONArray()
                    val groups = mutableListOf<NavigationGroup>()
                    for (i in 0 until groupsArray.length()) {
                        val groupObj = groupsArray.getJSONObject(i)
                        val label = groupObj.optString("label", "")
                        val itemsArray = groupObj.optJSONArray("items") ?: JSONArray()
                        val items = mutableListOf<NavigationItem>()
                        for (j in 0 until itemsArray.length()) {
                            val itemObj = itemsArray.getJSONObject(j)
                            items.add(NavigationItem(id = itemObj.optString("id", ""), label = itemObj.optString("label", "")))
                        }
                        groups.add(NavigationGroup(label = label, items = items))
                    }
                    ApiResult.Success(NavigationResponse(role = role, groups = groups))
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { null }
                    ApiResult.Error(msg ?: "Failed to fetch navigation (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to load navigation.")
        }
    }

    suspend fun fetchSupplierSection(section: String): ApiResult<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/supplier/$section"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val root = JSONObject(responseStr)
                    ApiResult.Success(root)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { null }
                    ApiResult.Error(msg ?: "Failed to load supplier $section (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to load supplier section $section.")
        }
    }

    suspend fun fetchAdminSection(section: String): ApiResult<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/$section"
            val request = Request.Builder().url(url).get().build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val root = JSONObject(responseStr)
                    ApiResult.Success(root)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { null }
                    ApiResult.Error(msg ?: "Failed to load admin section $section (HTTP ${response.code})")
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to load admin section $section.")
        }
    }

    suspend fun postSupplierAction(actionBody: JSONObject): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/supplier/actions"
            val request = Request.Builder()
                .url(url)
                .post(actionBody.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Supplier action completed.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Action failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to execute supplier action.")
        }
    }

    suspend fun updateSupplierStock(productId: String, stock: Int, costPrice: Double, hsnCode: String? = null): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "STOCK")
            put("productId", productId)
            put("stock", stock)
            put("costPrice", costPrice)
            if (!hsnCode.isNullOrEmpty()) put("hsnCode", hsnCode)
        }
        return postSupplierAction(body)
    }

    suspend fun createSupplierProduct(name: String, sku: String, description: String, costPrice: Double, stock: Int, hsnCode: String? = null): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PRODUCT")
            put("name", name)
            put("sku", sku)
            put("description", description)
            put("costPrice", costPrice)
            put("stock", stock)
            if (!hsnCode.isNullOrEmpty()) put("hsnCode", hsnCode)
        }
        return postSupplierAction(body)
    }

    suspend fun confirmSupplierReturnReceived(returnId: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "RETURN_RECEIVED")
            put("returnId", returnId)
        }
        return postSupplierAction(body)
    }

    suspend fun postAdminAction(actionBody: JSONObject): ApiResult<String> = withContext(Dispatchers.IO) {
        try {
            val url = "${sessionManager.baseUrl}/api/mobile/admin/actions"
            val request = Request.Builder()
                .url(url)
                .post(actionBody.toString().toRequestBody(jsonMediaType))
                .header("Content-Type", "application/json")
                .build()

            client.newCall(request).execute().use { response ->
                val responseStr = response.body?.string() ?: ""
                if (response.isSuccessful) {
                    val msg = JSONObject(responseStr).optString("message", "Admin action completed.")
                    ApiResult.Success(msg)
                } else {
                    val msg = try { JSONObject(responseStr).optString("message") } catch (_: Exception) { "Admin action failed (HTTP ${response.code})" }
                    ApiResult.Error(msg)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.localizedMessage ?: "Failed to execute admin action.")
        }
    }

    suspend fun confirmOrderDelivery(orderId: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "ORDER_DELIVERY")
            put("orderId", orderId)
        }
        return postAdminAction(body)
    }

    suspend fun collectCodPayment(orderId: String, reference: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "COD_COLLECTION")
            put("orderId", orderId)
            put("reference", reference)
        }
        return postAdminAction(body)
    }

    suspend fun updateOrderStatus(orderId: String, status: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "ORDER_STATUS")
            put("orderId", orderId)
            put("status", status)
        }
        return postAdminAction(body)
    }

    suspend fun reviewReturn(returnId: String, decision: String, notes: String = ""): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "RETURN_REVIEW")
            put("returnId", returnId)
            put("decision", decision)
            put("notes", notes)
        }
        return postAdminAction(body)
    }

    suspend fun updateProductStatus(productId: String, status: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PRODUCT_STATUS")
            put("productId", productId)
            put("status", status)
        }
        return postAdminAction(body)
    }

    suspend fun updateProductPricingAndStock(productId: String, sellingPrice: Double?, costPrice: Double?, stock: Int?): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PRODUCT_UPDATE")
            put("productId", productId)
            if (sellingPrice != null) put("sellingPrice", sellingPrice)
            if (costPrice != null) put("costPrice", costPrice)
            if (stock != null) put("stock", stock)
        }
        return postAdminAction(body)
    }

    suspend fun toggleUserStatus(userId: String, isActive: Boolean): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "USER_STATUS")
            put("userId", userId)
            put("isActive", isActive)
        }
        return postAdminAction(body)
    }

    suspend fun replyToSupportTicket(ticketId: String, reply: String, status: String = "RESOLVED"): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "SUPPORT_REPLY")
            put("ticketId", ticketId)
            put("reply", reply)
            put("status", status)
        }
        return postAdminAction(body)
    }

    suspend fun createExpense(category: String, amount: Double, description: String? = null): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "EXPENSE_CREATE")
            put("category", category)
            put("amount", amount)
            if (!description.isNullOrEmpty()) put("description", description)
        }
        return postAdminAction(body)
    }

    suspend fun createAdminProduct(
        name: String,
        sku: String,
        category: String?,
        sellingPrice: Double,
        costPrice: Double,
        stock: Int,
        description: String?,
        hsnCode: String?,
        status: String = "ACTIVE",
        supplierId: String? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PRODUCT_CREATE")
            put("name", name)
            put("sku", sku)
            if (!category.isNullOrEmpty()) put("category", category)
            put("sellingPrice", sellingPrice)
            put("costPrice", costPrice)
            put("stock", stock)
            if (!description.isNullOrEmpty()) put("description", description)
            if (!hsnCode.isNullOrEmpty()) put("hsnCode", hsnCode)
            put("status", status)
            if (!supplierId.isNullOrEmpty()) put("supplierId", supplierId)
        }
        return postAdminAction(body)
    }

    suspend fun createSupplier(
        companyName: String,
        contactName: String?,
        email: String?,
        phone: String?,
        sourceType: String = "DIRECT",
        pickupAddress: String? = null,
        pickupCity: String? = null,
        pickupState: String? = null,
        gstNumber: String? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "SUPPLIER_CREATE")
            put("companyName", companyName)
            if (!contactName.isNullOrEmpty()) put("contactName", contactName)
            if (!email.isNullOrEmpty()) put("email", email)
            if (!phone.isNullOrEmpty()) put("phone", phone)
            put("sourceType", sourceType)
            if (!pickupAddress.isNullOrEmpty()) put("pickupAddress", pickupAddress)
            if (!pickupCity.isNullOrEmpty()) put("pickupCity", pickupCity)
            if (!pickupState.isNullOrEmpty()) put("pickupState", pickupState)
            if (!gstNumber.isNullOrEmpty()) put("gstNumber", gstNumber)
        }
        return postAdminAction(body)
    }

    suspend fun recordSupplierSettlement(
        supplierId: String,
        amount: Double,
        reference: String,
        notes: String? = null,
        paidAt: String? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "SUPPLIER_SETTLEMENT")
            put("supplierId", supplierId)
            put("amount", amount)
            put("reference", reference)
            if (!notes.isNullOrEmpty()) put("notes", notes)
            if (!paidAt.isNullOrEmpty()) put("paidAt", paidAt)
        }
        return postAdminAction(body)
    }

    suspend fun uploadPhoto(
        fileBytes: ByteArray,
        fileName: String,
        mimeType: String = "image/jpeg",
        productId: String? = null,
        categoryId: String? = null,
        kind: String = "products"
    ): ApiResult<JSONObject> = withContext(Dispatchers.IO) {
        try {
            val url = "$baseUrl/api/mobile/upload"
            val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
            builder.addFormDataPart("file", fileName, fileBytes.toRequestBody(mimeType.toMediaType()))
            builder.addFormDataPart("kind", kind)
            if (!productId.isNullOrEmpty()) builder.addFormDataPart("productId", productId)
            if (!categoryId.isNullOrEmpty()) builder.addFormDataPart("categoryId", categoryId)

            val request = Request.Builder()
                .url(url)
                .post(builder.build())
                .build()

            client.newCall(request).execute().use { response ->
                val bodyStr = response.body?.string().orEmpty()
                if (response.isSuccessful) {
                    ApiResult.Success(if (bodyStr.isNotEmpty()) JSONObject(bodyStr) else JSONObject())
                } else {
                    val msg = parseErrorMessage(bodyStr, "Upload failed with HTTP ${response.code}")
                    ApiResult.Error(msg, response.code)
                }
            }
        } catch (e: Exception) {
            ApiResult.Error(e.message ?: "Failed to upload photo")
        }
    }

    suspend fun createCategory(
        name: String,
        slug: String? = null,
        description: String = "",
        imageUrl: String? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "CATEGORY_CREATE")
            put("name", name)
            if (!slug.isNullOrEmpty()) put("slug", slug)
            put("description", description)
            if (!imageUrl.isNullOrEmpty()) put("imageUrl", imageUrl)
        }
        return postAdminAction(body)
    }

    suspend fun updateCategory(
        categoryId: String,
        name: String? = null,
        description: String? = null,
        imageUrl: String? = null,
        isVisible: Boolean? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "CATEGORY_UPDATE")
            put("categoryId", categoryId)
            if (!name.isNullOrEmpty()) put("name", name)
            if (!description.isNullOrEmpty()) put("description", description)
            if (!imageUrl.isNullOrEmpty()) put("imageUrl", imageUrl)
            if (isVisible != null) put("isVisible", isVisible)
        }
        return postAdminAction(body)
    }

    suspend fun updateInventory(productId: String, availableQty: Int): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "INVENTORY_UPDATE")
            put("productId", productId)
            put("availableQty", availableQty)
        }
        return postAdminAction(body)
    }

    suspend fun createVoucher(
        customerId: String,
        code: String,
        balance: Double,
        expiresAt: String? = null
    ): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "VOUCHER_CREATE")
            put("customerId", customerId)
            put("code", code)
            put("balance", balance)
            if (!expiresAt.isNullOrEmpty()) put("expiresAt", expiresAt)
        }
        return postAdminAction(body)
    }

    suspend fun deleteProductPhoto(productId: String, photoUrl: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PHOTO_DELETE")
            put("productId", productId)
            put("photoUrl", photoUrl)
        }
        return postAdminAction(body)
    }

    suspend fun setProductCoverPhoto(productId: String, photoUrl: String): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "PHOTO_COVER")
            put("productId", productId)
            put("photoUrl", photoUrl)
        }
        return postAdminAction(body)
    }

    suspend fun triggerCjSync(syncType: String = "orders"): ApiResult<String> {
        val body = JSONObject().apply {
            put("action", "CJ_SYNC")
            put("syncType", syncType)
        }
        return postAdminAction(body)
    }
}
