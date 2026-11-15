package `in`.zerasworld.admin

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

private fun JSONObject.display(key: String) = if (isNull(key)) "" else optString(key)
private fun JSONArray.objects() = (0 until length()).mapNotNull { optJSONObject(it) }
private fun label(key: String) = key.replace(Regex("([a-z])([A-Z])"), "$1 $2").replaceFirstChar { it.uppercase() }
private fun errorText(value: String): String = try { JSONObject(value.substringAfter(": ", value)).optString("message", value) } catch (_: Exception) { value }

@Composable
private fun WorkflowChoice(field: WorkflowField, value: String, enabled: Boolean, onValue: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Column {
        OutlinedButton(onClick = { expanded = true }, enabled = enabled, modifier = Modifier.fillMaxWidth()) {
            Text("${field.label}: ${field.options.find { it.first == value }?.second ?: "None"}")
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            if (!field.required) DropdownMenuItem(text = { Text("None") }, onClick = { onValue(""); expanded = false })
            field.options.forEach { option -> DropdownMenuItem(text = { Text(option.second) }, onClick = { onValue(option.first); expanded = false }) }
        }
    }
}

@Composable
fun WorkflowForm(repository: AdminApiRepository, edit: WorkflowEdit, onDismiss: () -> Unit, onSaved: (JSONObject) -> Unit) {
    var values by remember(edit) { mutableStateOf(edit.fields.associate { it.key to edit.initial.display(it.key) }) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var usd by remember { mutableStateOf("") }
    var rate by remember { mutableStateOf("") }
    var markup by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()
    AlertDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text(edit.title) },
        text = {
            Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (edit.message.isNotBlank()) Text(edit.message)
                edit.fields.forEach { field ->
                    val value = values[field.key].orEmpty()
                    when (field.type) {
                        "choice" -> WorkflowChoice(field, value, !busy) { values = values + (field.key to it) }
                        "bool" -> Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(field.label, Modifier.weight(1f)); Switch(checked = value == "true", enabled = !busy, onCheckedChange = { values = values + (field.key to it.toString()) })
                        }
                        else -> OutlinedTextField(value = value, onValueChange = { values = values + (field.key to it) }, enabled = !busy,
                            label = { Text(field.label + if (field.required) " *" else "") }, modifier = Modifier.fillMaxWidth(),
                            visualTransformation = if (field.type == "secret") androidx.compose.ui.text.input.PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None)
                    }
                }
                if (edit.pricing) {
                    HorizontalDivider(); Text("USD conversion and markup")
                    OutlinedTextField(usd, { usd = it }, label = { Text("Cost in USD (optional)") }, enabled = !busy)
                    OutlinedTextField(rate, { rate = it }, label = { Text("USD to INR rate") }, enabled = !busy)
                    TextButton(enabled = !busy, onClick = { scope.launch {
                        busy = true
                        when (val result = repository.requestMobileApi("/api/mobile/products/exchange-rate")) {
                            is ApiResult.Success -> { rate = JSONObject(result.data).getJSONObject("data").getString("rate"); error = null }
                            is ApiResult.Error -> error = "${errorText(result.message)} You can enter a rate manually."
                        }
                        busy = false
                    } }) { Text("Load latest rate") }
                    Text("Rates by ExchangeRate-API. Actual payment rates may differ.")
                    OutlinedTextField(markup, { markup = it }, label = { Text("Markup on cost (%)") }, enabled = !busy)
                    TextButton(enabled = !busy, onClick = { scope.launch {
                        try {
                            val payload = JSONObject()
                            if (usd.isNotBlank()) { payload.put("usdCost", usd.toDouble()); payload.put("exchangeRate", rate.toDouble()) }
                            else payload.put("costPrice", values["costPrice"].orEmpty().toDouble())
                            if (markup.isNotBlank()) payload.put("markupPercent", markup.toDouble())
                            busy = true
                            when (val result = repository.requestMobileApi("/api/mobile/products/pricing", "POST", payload)) {
                                is ApiResult.Success -> { val data = JSONObject(result.data).getJSONObject("data"); values = values + ("costPrice" to data.getString("costPrice")); if (data.has("sellingPrice")) values = values + ("sellingPrice" to data.getString("sellingPrice")); error = null }
                                is ApiResult.Error -> error = errorText(result.message)
                            }
                        } catch (_: Exception) { error = "Enter valid cost, exchange rate and markup numbers." }
                        finally { busy = false }
                    } }) { Text("Calculate and fill prices") }
                }
                error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
                if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            }
        }, confirmButton = { Button(enabled = !busy, onClick = { scope.launch {
            try {
                var payload = MobileWorkflow.fieldsPayload(edit.fields, values)
                if (edit.path == "/api/mobile/admin/integrations") payload = JSONObject().put("credentials", payload)
                edit.fixed.keys().forEach { key -> payload.put(key, edit.fixed.get(key)) }
                busy = true; error = null
                when (val result = repository.requestMobileApi(edit.path, edit.method, payload)) {
                    is ApiResult.Success -> onSaved(JSONObject(result.data))
                    is ApiResult.Error -> error = errorText(result.message)
                }
            } catch (exception: Exception) { error = exception.message ?: "Check the entered values." }
            finally { busy = false }
        } }) { Text(if (edit.method == "DELETE") "Confirm delete" else "Confirm and save") } },
        dismissButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Cancel") } })
}

@Composable
private fun RecordFields(record: JSONObject) {
    record.keys().forEach { key ->
        val value = record.opt(key)
        when {
            value == null || value == JSONObject.NULL || value.toString().isBlank() -> {}
            key == "imageUrls" || key == "imagePublicId" -> {}
            value is JSONObject -> { Text(label(key), style = MaterialTheme.typography.titleSmall); RecordFields(value) }
            value is JSONArray -> value.objects().forEach { item -> HorizontalDivider(); RecordFields(item) }
            else -> Text("${label(key)}: $value", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
fun ConnectedAdminTab(repository: AdminApiRepository, section: String, title: String, role: String) {
    var data by remember(section) { mutableStateOf<Any?>(null) }
    var page by remember(section) { mutableIntStateOf(1) }
    var more by remember(section) { mutableStateOf(false) }
    var busy by remember(section) { mutableStateOf(false) }
    var message by remember(section) { mutableStateOf<String?>(null) }
    var edit by remember(section) { mutableStateOf<WorkflowEdit?>(null) }
    var photos by remember(section) { mutableStateOf<JSONObject?>(null) }
    var receipt by remember(section) { mutableStateOf<JSONObject?>(null) }
    val scope = rememberCoroutineScope()
    fun load() { scope.launch {
        busy = true; message = null
        when (val result = repository.fetchAdminSection(section, page, 25)) {
            is ApiResult.Success -> {
                val response = JSONObject(result.data); data = response.opt("data")
                more = response.optJSONObject("meta")?.let { meta -> meta.optBoolean("hasMore") || meta.optJSONObject("collections")?.let { collections -> collections.keys().asSequence().any { collections.getJSONObject(it).optBoolean("hasMore") } } == true } == true
            }
            is ApiResult.Error -> message = errorText(result.message)
        }
        busy = false
    } }
    fun detail(item: JSONObject, then: (JSONObject) -> Unit) { scope.launch {
        busy = true; message = null
        val key = if (section == "payments") item.optString("orderId") else item.optString("id")
        val target = if (section == "payments") "orders" else section
        when (val result = repository.requestMobileApi("/api/mobile/admin/$target/${MobileWorkflow.id(key)}")) {
            is ApiResult.Success -> then(JSONObject(result.data).getJSONObject("data"))
            is ApiResult.Error -> message = errorText(result.message)
        }
        busy = false
    } }
    fun productEdit(item: JSONObject?) { scope.launch {
        busy = true; message = null
        when (val result = repository.requestMobileApi("/api/mobile/products/options")) {
            is ApiResult.Success -> {
                val options = JSONObject(result.data).getJSONObject("data")
                val categories = options.getJSONArray("categories").objects()
                val categoryChoices = categories.map { category -> category.getString("id") to ((categories.find { it.optString("id") == category.optString("parentId") }?.optString("name")?.plus(" / ") ?: "") + category.getString("name")) }
                val supplierChoices = options.getJSONArray("suppliers").objects().map { it.getString("id") to it.getString("companyName") }
                val defaults = item ?: JSONObject().put("status", "DRAFT").put("availableQty", 0).put("costPrice", 0).put("gstRate", 0).put("deliveryCharge", 0).put("handlingCharge", 0).put("returnDays", 0).put("isReturnable", true).put("codAvailable", false)
                edit = WorkflowEdit(if (item == null) "Create product" else "Edit product", "/api/mobile/products" + (item?.let { "/${MobileWorkflow.id(it.getString("id"))}" } ?: ""), if (item == null) "POST" else "PATCH",
                    MobileWorkflow.productFields(categoryChoices, supplierChoices, item == null), defaults, pricing = true, afterSaveProduct = true,
                    message = "Save the product, then choose photos from your device. Existing stock is adjusted separately.")
            }
            is ApiResult.Error -> message = errorText(result.message)
        }
        busy = false
    } }
    fun categoryEdit(item: JSONObject?) { scope.launch {
        busy = true
        when (val result = repository.requestMobileApi("/api/mobile/products/options")) {
            is ApiResult.Success -> {
                val categories = JSONObject(result.data).getJSONObject("data").getJSONArray("categories").objects()
                val parents = categories.filter { it.isNull("parentId") && it.optString("id") != item?.optString("id") }.map { it.getString("id") to it.getString("name") }
                edit = WorkflowEdit(if (item == null) "Create category" else "Edit category", "/api/mobile/admin/categories" + (item?.let { "/${MobileWorkflow.id(it.getString("id"))}" } ?: ""), if (item == null) "POST" else "PATCH",
                    MobileWorkflow.categoryFields(parents), item ?: JSONObject().put("sortOrder", 0).put("isVisible", true))
            }
            is ApiResult.Error -> message = errorText(result.message)
        }
        busy = false
    } }
    LaunchedEffect(section, page) { load() }
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(enabled = !busy, onClick = { load() }) { Text("Refresh") }
            when (section) {
                "products" -> Button(enabled = !busy, onClick = { productEdit(null) }) { Text("Add product") }
                "categories" -> Button(enabled = !busy, onClick = { categoryEdit(null) }) { Text("Add category") }
                "fulfillment", "tracking" -> Button(enabled = !busy, onClick = {
                    edit = WorkflowEdit("Record shipment", "/api/mobile/admin/shipments", fields = listOf(WorkflowField("orderId", "Order ID", required = true), WorkflowField("supplierId", "Supplier ID (optional)"), WorkflowField("courierName", "Courier", "choice", true, listOf("Delhivery" to "Delhivery", "Shiprocket" to "Shiprocket")), WorkflowField("awb", "Booked AWB", required = true), WorkflowField("shipmentCost", "Shipment cost", "money", true)), initial = JSONObject().put("courierName", "Delhivery").put("shipmentCost", 0))
                }) { Text("Record shipment") }
                "profit-expenses" -> Button(enabled = !busy, onClick = { edit = WorkflowEdit("Add expense", "/api/mobile/admin/expenses", fields = listOf(WorkflowField("category", "Category", required = true), WorkflowField("description", "Description"), WorkflowField("amount", "Amount (INR)", "money", true), WorkflowField("expenseDate", "Expense date (ISO timestamp)", required = true)), initial = JSONObject().put("expenseDate", java.time.Instant.now().toString())) }) { Text("Add expense") }
                "gift-cards" -> if (role == "ADMIN") Button(enabled = !busy, onClick = { edit = WorkflowEdit("Issue gift card", "/api/mobile/admin/gift-cards", fields = listOf(WorkflowField("customerEmail", "Customer email", required = true), WorkflowField("code", "Code (8–40 characters)", required = true), WorkflowField("amount", "Amount (INR)", "money", true), WorkflowField("expiresOn", "Expiry date (YYYY-MM-DD, optional)")), message = "This issues customer credit. Verify the customer and amount before confirming.") }) { Text("Issue gift card") }
            }
        }
        if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        message?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        val records = (data as? JSONArray)?.objects()
        if (records != null) {
            if (records.isEmpty() && !busy) Text("No records on this page.")
            records.forEach { record ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        RecordFields(record)
                        when (section) {
                            "products" -> {
                                Button(enabled = !busy, onClick = { detail(record) { productEdit(it) } }) { Text("Edit product") }
                                OutlinedButton(enabled = !busy, onClick = { detail(record) { photos = it } }) { Text("Photos and CJ variants") }
                                OutlinedButton(enabled = !busy, onClick = { edit = MobileWorkflow.productStockEdit(record.getString("id")) }) { Text("Adjust stock") }
                                OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Delete product", "/api/mobile/products/${MobileWorkflow.id(record.getString("id"))}", "DELETE", message = "Delete ${record.optString("name")}? Products with order or financial history must be archived using Edit product instead.") }) { Text("Delete unused product") }
                            }
                            "categories" -> {
                                Button(enabled = !busy, onClick = { detail(record) { categoryEdit(it) } }) { Text("Edit category") }
                                OutlinedButton(enabled = !busy, onClick = { photos = record }) { Text("Category photo") }
                                OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Delete category", "/api/mobile/admin/categories/${MobileWorkflow.id(record.getString("id"))}", "DELETE", message = "Delete ${record.optString("name")}? Move its products and subcategories first.") }) { Text("Delete category") }
                            }
                            "inventory" -> OutlinedButton(enabled = !busy, onClick = { detail(record) { try { edit = MobileWorkflow.inventoryEdit(it) } catch (exception: Exception) { message = exception.message } } }) { Text("Adjust inventory") }
                            "orders", "invoices", "payments" -> {
                                Button(enabled = !busy, onClick = { detail(record) { receipt = it } }) { Text("Order receipt and payment") }
                            }
                            "fulfillment", "tracking" -> OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Refresh shipment tracking", "/api/mobile/admin/shipments/${MobileWorkflow.id(record.getString("id"))}/track", message = "Refresh carrier events for ${record.optString("trackingNumber")}. Delivery confirmation is a separate action.") }) { Text("Refresh tracking") }
                            "returns" -> {
                                if (record.optString("status") == "OPEN") listOf("APPROVED" to "Approve", "REJECTED" to "Reject").forEach { (action, name) -> OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("$name return", "/api/mobile/admin/returns/${MobileWorkflow.id(record.getString("id"))}", fields = listOf(WorkflowField("notes", "Review notes")), fixed = JSONObject().put("action", action)) }) { Text(name) } }
                                if (record.optString("status") == "APPROVED") OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Confirm physical receipt", "/api/mobile/admin/returns/${MobileWorkflow.id(record.getString("id"))}", fixed = JSONObject().put("action", "RECEIVED"), message = "Confirm that the returned goods have been received.") }) { Text("Confirm receipt") }
                                if (record.optString("status") == "COMPLETED") OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Process return refund", "/api/mobile/admin/returns/${MobileWorkflow.id(record.getString("id"))}/refund", message = "Submit the eligible item refund to the original payment method. Check existing refunds before retrying.") }) { Text("Process refund") }
                            }
                            "settings", "sellers" -> if (role == "ADMIN") OutlinedButton(enabled = !busy, onClick = {
                                val fields = record.optJSONArray("fields") ?: JSONArray()
                                edit = WorkflowEdit("Configure ${record.optString("provider")}", "/api/mobile/admin/integrations", fields = (0 until fields.length()).map { WorkflowField(fields.getString(it), label(fields.getString(it)), "secret") }, fixed = JSONObject().put("provider", record.getString("provider")), message = "Blank fields preserve saved credentials. Saving does not verify a live connector.")
                            }) { Text("Configure credentials") }
                            "users" -> if (role == "ADMIN") OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("User role and access", "/api/mobile/admin/users/${MobileWorkflow.id(record.getString("id"))}", "PATCH", listOf(WorkflowField("role", "Role", "choice", true, listOf("ADMIN", "MANAGER", "STAFF", "SUPPLIER", "CUSTOMER").map { it to it }), WorkflowField("isActive", "Active", "bool")), record, message = "Changing access revokes this user's existing sessions.") }) { Text("Manage access") }
                        }
                    }
                }
            }
        } else if (data is JSONObject) RecordFields(data as JSONObject)
        if (records != null || (data as? JSONObject)?.keys()?.asSequence()?.any { (data as JSONObject).opt(it) is JSONArray } == true) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(enabled = page > 1 && !busy, onClick = { page-- }) { Text("Previous") }
            Text("Page $page", Modifier.padding(top = 12.dp))
            OutlinedButton(enabled = more && !busy, onClick = { page++ }) { Text("Next") }
        }
    }
    edit?.let { current -> WorkflowForm(repository, current, { edit = null }) { response ->
        edit = null
        if (current.afterSaveProduct) photos = response.optJSONObject("data")
        load()
    } }
    photos?.let { PhotoWorkflow(repository, it, section == "categories", { photos = null; load() }) }
    receipt?.let { ReceiptWorkflow(repository, it, { receipt = null; load() }) }
}

@Composable
fun PhotoWorkflow(repository: AdminApiRepository, initial: JSONObject, category: Boolean, onDismiss: () -> Unit) {
    var record by remember { mutableStateOf(initial) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var edit by remember { mutableStateOf<WorkflowEdit?>(null) }
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    suspend fun refresh() {
        val path = if (category) "/api/mobile/admin/categories/" else "/api/mobile/products/"
        when (val result = repository.requestMobileApi(path + MobileWorkflow.id(record.getString("id")))) {
            is ApiResult.Success -> record = JSONObject(result.data).getJSONObject("data")
            is ApiResult.Error -> error = errorText(result.message)
        }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? -> if (uri != null) scope.launch {
        busy = true; error = null
        try {
            val bytes = withContext(Dispatchers.IO) {
                context.contentResolver.openInputStream(uri)?.use { input ->
                    val output = ByteArrayOutputStream(); val buffer = ByteArray(8192); var size = 0
                    while (true) { val count = input.read(buffer); if (count < 0) break; size += count; require(size <= 5 * 1024 * 1024) { "Each photo must be at most 5 MB." }; output.write(buffer, 0, count) }
                    output.toByteArray()
                } ?: throw IllegalStateException("Cannot read the selected photo.")
            }
            val mime = context.contentResolver.getType(uri).orEmpty()
            require(mime in listOf("image/jpeg", "image/png", "image/webp")) { "Choose a JPEG, PNG or WebP photo." }
            when (val result = repository.uploadPhoto(bytes, "photo.${if (mime == "image/jpeg") "jpg" else mime.substringAfter('/')}", mime,
                if (category) "categories" else "products", productId = if (category) null else record.getString("id"), categoryId = if (category) record.getString("id") else null)) {
                is ApiResult.Success -> refresh()
                is ApiResult.Error -> error = errorText(result.message)
            }
        } catch (exception: Exception) { error = exception.message ?: "Photo upload failed." }
        finally { busy = false }
    } }
    AlertDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text(if (category) "Category photo" else "Product photos") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("${record.optString("name")} · JPEG, PNG or WebP, up to 5 MB each.")
            val images = if (category) listOf(record.display("imageUrl")).filter { it.isNotBlank() } else record.optJSONArray("imageUrls")?.let { urls -> (0 until urls.length()).map { urls.getString(it) } }.orEmpty()
            images.forEachIndexed { index, url ->
                AsyncImage(model = url, contentDescription = "Photo ${index + 1}", modifier = Modifier.fillMaxWidth().height(150.dp))
                if (!category) {
                    Text(if (index == 0) "Cover photo" else "Photo ${index + 1}")
                    Row {
                        if (index > 0) TextButton(enabled = !busy, onClick = { edit = WorkflowEdit("Set cover photo", "/api/mobile/admin/actions", fixed = JSONObject().put("action", "PHOTO_COVER").put("productId", record.getString("id")).put("photoUrl", url)) }) { Text("Make cover") }
                        TextButton(enabled = !busy, onClick = { edit = WorkflowEdit("Remove product photo", "/api/mobile/admin/actions", fixed = JSONObject().put("action", "PHOTO_DELETE").put("productId", record.getString("id")).put("photoUrl", url), message = "Remove this photo from the product?") }) { Text("Remove") }
                    }
                }
            }
            Button(enabled = !busy && (category || images.size < 6), onClick = { picker.launch("image/*") }) { Text(if (category) "Choose replacement photo" else "Upload photo (${images.size}/6)") }
            if (category && images.isNotEmpty()) OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Remove category photo", "/api/mobile/admin/categories/${MobileWorkflow.id(record.getString("id"))}/image", "DELETE", message = "Remove the banner image from this category?") }) { Text("Remove category photo") }
            if (!category) OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Import CJ variants", "/api/mobile/products/cj-variants", fields = listOf(WorkflowField("cjProductId", "CJ product ID", required = true)), fixed = JSONObject().put("productId", record.getString("id")), message = "Requires an active CJ supplier. Imports variant mappings; existing prices, photos and stock are preserved.") }) { Text("Import CJ variants") }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
            error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            notice?.let { Text(it) }
        }
    }, confirmButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Done") } })
    edit?.let { WorkflowForm(repository, it, { edit = null }) { response -> edit = null; notice = response.optString("message", "Saved."); scope.launch { busy = true; refresh(); busy = false } } }
}

@Composable
fun ReceiptWorkflow(repository: AdminApiRepository, order: JSONObject, onDismiss: () -> Unit) {
    var edit by remember { mutableStateOf<WorkflowEdit?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val savePdf = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/pdf")) { uri ->
        if (uri != null) scope.launch {
            busy = true
            try { withContext(Dispatchers.IO) { context.contentResolver.openOutputStream(uri)?.use { ReceiptPdf.write(order, it) } ?: error("Cannot write receipt.") }; message = "Receipt saved." }
            catch (exception: Exception) { message = exception.message ?: "Receipt could not be saved." }
            finally { busy = false }
        }
    }
    AlertDialog(onDismissRequest = { if (!busy) onDismiss() }, title = { Text("Order receipt") }, text = {
        Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Order summary; not a separately numbered tax invoice.")
            RecordFields(order)
            OutlinedButton(enabled = !busy, onClick = { savePdf.launch("order-${order.optString("marketplaceOrderId").replace(Regex("[^a-zA-Z0-9-]"), "_")}.pdf") }) { Text("Save receipt PDF") }
            val payments = order.optJSONArray("payments")?.objects().orEmpty()
            if (order.optString("status") == "DELIVERED" && payments.any { it.optString("provider") == "COD" && it.optString("paymentStatus") == "PENDING" }) {
                Button(enabled = !busy, onClick = { try { edit = MobileWorkflow.codEdit(order) } catch (exception: Exception) { message = exception.message } }) { Text("Record COD collected") }
            }
            if (order.optString("status") in listOf("CONFIRMED", "PROCESSING", "SHIPPED")) OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Confirm delivery", "/api/mobile/admin/orders/${MobileWorkflow.id(order.getString("id"))}/delivery", message = "Confirm actual delivery of ${order.optString("marketplaceOrderId")}. This starts the return window.") }) { Text("Confirm delivery") }
            val next = when (order.optString("status")) { "PENDING" -> "CONFIRMED"; "CONFIRMED" -> "PROCESSING"; else -> null }
            if (next != null) OutlinedButton(enabled = !busy, onClick = { edit = WorkflowEdit("Move order to $next", "/api/mobile/admin/actions", fixed = JSONObject().put("action", "ORDER_STATUS").put("orderId", order.getString("id")).put("status", next), message = "The server checks payment and the current order state before saving.") }) { Text("Mark $next") }
            message?.let { Text(it) }
            if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
        }
    }, confirmButton = { TextButton(enabled = !busy, onClick = onDismiss) { Text("Close") } })
    edit?.let { WorkflowForm(repository, it, { edit = null }) { edit = null; onDismiss() } }
}
