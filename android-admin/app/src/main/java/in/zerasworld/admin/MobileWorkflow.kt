package `in`.zerasworld.admin

import org.json.JSONObject
import java.net.URLEncoder

data class WorkflowField(
    val key: String, val label: String, val type: String = "text", val required: Boolean = false,
    val options: List<Pair<String, String>> = emptyList(), val nullable: Boolean = false
)

data class WorkflowEdit(
    val title: String, val path: String, val method: String = "POST",
    val fields: List<WorkflowField> = emptyList(), val initial: JSONObject = JSONObject(),
    val fixed: JSONObject = JSONObject(), val pricing: Boolean = false,
    val message: String = "", val afterSaveProduct: Boolean = false
)

object MobileWorkflow {
    fun id(value: String): String = URLEncoder.encode(value, "UTF-8").replace("+", "%20")
    fun fieldsPayload(fields: List<WorkflowField>, values: Map<String, String>): JSONObject {
        val payload = JSONObject()
        for (field in fields) {
            val text = values[field.key].orEmpty().trim()
            require(!field.required || text.isNotEmpty()) { "${field.label} is required." }
            if (field.type == "bool") { payload.put(field.key, text == "true"); continue }
            if (text.isEmpty()) {
                if (field.nullable) payload.put(field.key, JSONObject.NULL)
                else if (field.type == "text" || field.type == "choice") payload.put(field.key, "")
                continue
            }
            when (field.type) {
                "money", "number" -> {
                    val number = text.toDoubleOrNull()
                    require(number != null && number.isFinite() && number >= 0) { "${field.label} must be a non-negative number." }
                    payload.put(field.key, number)
                }
                "int" -> {
                    val number = text.toIntOrNull()
                    require(number != null && number >= 0) { "${field.label} must be a non-negative whole number." }
                    payload.put(field.key, number)
                }
                "choice" -> {
                    require(field.options.any { it.first == text }) { "Select a valid ${field.label}." }
                    payload.put(field.key, text)
                }
                else -> payload.put(field.key, text)
            }
        }
        return payload
    }

    fun categoryFields(parents: List<Pair<String, String>>) = listOf(
        WorkflowField("name", "Name", required = true), WorkflowField("slug", "URL slug", required = true),
        WorkflowField("description", "Description"), WorkflowField("parentId", "Parent category", "choice", options = parents, nullable = true),
        WorkflowField("sortOrder", "Display order", "int", true), WorkflowField("isVisible", "Visible in menu", "bool")
    )

    val inventoryFields = listOf(
        WorkflowField("availableQty", "Available quantity", "int", true),
        WorkflowField("reservedQty", "Reserved quantity", "int", true),
        WorkflowField("damagedQty", "Damaged quantity", "int", true),
        WorkflowField("safetyStock", "Safety stock", "int", true)
    )

    fun productStockEdit(productId: String) = WorkflowEdit("Adjust product stock", "/api/mobile/admin/products/${id(productId)}/stock",
        fields = listOf(WorkflowField("quantity", "Available quantity", "int", true)))

    fun inventoryEdit(item: JSONObject): WorkflowEdit {
        require(item.optString("updatedAt").isNotBlank()) { "Refresh this stock record before editing." }
        return WorkflowEdit("Adjust inventory", "/api/mobile/admin/inventory/${id(item.getString("id"))}", "PATCH",
            inventoryFields, item, JSONObject().put("updatedAt", item.getString("updatedAt")),
            message = "Reserved stock cannot exceed available stock. Conflicts require a refresh.")
    }

    fun codEdit(order: JSONObject): WorkflowEdit {
        require(order.optString("status") == "DELIVERED" && !order.isNull("deliveredAt")) { "Confirm delivery before collecting COD." }
        val payments = order.optJSONArray("payments")
        require(payments != null && (0 until payments.length()).any {
            val payment = payments.getJSONObject(it)
            payment.optString("provider") == "COD" && payment.optString("paymentStatus") == "PENDING"
        }) { "No pending COD payment is available." }
        return WorkflowEdit("Record COD receipt", "/api/mobile/admin/orders/${id(order.getString("id"))}/cod-collection",
            fields = listOf(WorkflowField("reference", "Courier remittance / receipt reference", required = true)),
            message = "Record INR ${order.optString("totalAmount")} received for ${order.optString("marketplaceOrderId")}. This updates the payment record.")
    }

    fun productFields(categories: List<Pair<String, String>>, suppliers: List<Pair<String, String>>, creating: Boolean): List<WorkflowField> = listOf(
        WorkflowField("name", "Product name", required = true), WorkflowField("sku", "SKU", required = true),
        WorkflowField("categoryId", "Category / subcategory", "choice", options = categories),
        WorkflowField("supplierId", "Supplier", "choice", options = suppliers),
        WorkflowField("status", "Status", "choice", true, listOf("DRAFT" to "Draft", "ACTIVE" to "Active", "ARCHIVED" to "Archived")),
        WorkflowField("sellingPrice", "Selling price (INR)", "money"), WorkflowField("costPrice", "Cost price (INR)", "money"),
        WorkflowField("mrp", "MRP (INR)", "money", nullable = true), WorkflowField("hsnCode", "HSN code", nullable = true),
        WorkflowField("brand", "Brand"), WorkflowField("size", "Size", nullable = true), WorkflowField("color", "Colour", nullable = true),
        WorkflowField("gstRate", "GST (%)", "number", true), WorkflowField("deliveryCharge", "Delivery charge (INR)", "money", true),
        WorkflowField("handlingCharge", "Handling charge (INR)", "money", true), WorkflowField("returnDays", "Return window (days)", "int", true),
        WorkflowField("isReturnable", "Returnable", "bool"), WorkflowField("codAvailable", "Cash on delivery", "bool"),
        WorkflowField("description", "Description"), WorkflowField("specifications", "Specifications", nullable = true),
        WorkflowField("manufacturerInfo", "Manufacturer information", nullable = true), WorkflowField("warranty", "Warranty", nullable = true),
        WorkflowField("trend", "Trend", nullable = true), WorkflowField("inTheBox", "In the box", nullable = true)
    ) + if (creating) listOf(WorkflowField("availableQty", "Opening stock", "int", true)) else emptyList()
}
