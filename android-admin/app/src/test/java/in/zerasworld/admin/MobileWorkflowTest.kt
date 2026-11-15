package `in`.zerasworld.admin

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class MobileWorkflowTest {
    @Test fun productStockUsesQuantityContractRatherThanInventoryPayload() {
        val edit = MobileWorkflow.productStockEdit("product")
        assertEquals("/api/mobile/admin/products/product/stock", edit.path)
        val payload = MobileWorkflow.fieldsPayload(edit.fields, mapOf("quantity" to "8"))
        assertEquals(8, payload.getInt("quantity"))
        assertFalse(payload.has("availableQty"))
    }
    @Test fun inventoryPreservesVersionAndRejectsInvalidQuantities() {
        val record = JSONObject().put("id", "stock/one").put("updatedAt", "2026-11-15T00:00:00.000Z")
        val edit = MobileWorkflow.inventoryEdit(record)
        assertEquals("/api/mobile/admin/inventory/stock%2Fone", edit.path)
        assertEquals("PATCH", edit.method)
        assertEquals(record.getString("updatedAt"), edit.fixed.getString("updatedAt"))
        val values = mapOf("availableQty" to "10", "reservedQty" to "2", "damagedQty" to "0", "safetyStock" to "1")
        assertEquals(10, MobileWorkflow.fieldsPayload(edit.fields, values).getInt("availableQty"))
        listOf("", "no", "-1", "1.5").forEach { invalid ->
            assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.fieldsPayload(edit.fields, values + ("availableQty" to invalid)) }
        }
        assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.inventoryEdit(JSONObject().put("id", "stock")) }
    }

    @Test fun codCollectionRequiresDeliveredOrderAndPendingCodPayment() {
        val order = JSONObject().put("id", "order").put("status", "DELIVERED").put("deliveredAt", "2026-11-15T00:00:00Z")
            .put("payments", JSONArray().put(JSONObject().put("provider", "COD").put("paymentStatus", "PENDING")))
        val edit = MobileWorkflow.codEdit(order)
        assertEquals("/api/mobile/admin/orders/order/cod-collection", edit.path)
        assertEquals("reference", edit.fields.single().key)
        order.put("status", "SHIPPED")
        assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.codEdit(order) }
        order.put("status", "DELIVERED").getJSONArray("payments").getJSONObject(0).put("paymentStatus", "PAID")
        assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.codEdit(order) }
    }

    @Test fun productEditingDoesNotSendStockAndClearsNullableFields() {
        val fields = MobileWorkflow.productFields(listOf("category" to "Category"), listOf("supplier" to "Supplier"), false)
        assertFalse(fields.any { it.key == "availableQty" || it.key == "imageUrls" })
        val values = fields.associate { it.key to when (it.type) { "int", "number", "money" -> "0"; "bool" -> "false"; else -> "" } } +
            mapOf("name" to "Product", "sku" to "SKU", "status" to "DRAFT", "mrp" to "", "hsnCode" to "", "categoryId" to "category", "supplierId" to "supplier")
        val payload = MobileWorkflow.fieldsPayload(fields, values)
        assertTrue(payload.isNull("mrp")); assertTrue(payload.isNull("hsnCode"))
        assertEquals("category", payload.getString("categoryId"))
        assertEquals("supplier", payload.getString("supplierId"))
        assertFalse(payload.has("availableQty")); assertFalse(payload.has("imageUrls"))
        assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.fieldsPayload(fields, values + ("categoryId" to "unknown")) }
        assertThrows(IllegalArgumentException::class.java) { MobileWorkflow.fieldsPayload(fields, values + ("sellingPrice" to "NaN")) }
    }
}
