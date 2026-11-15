package `in`.zerasworld.admin

import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.ByteArrayOutputStream

class ConnectedWorkflowTest {
    @get:Rule val compose = createAndroidComposeRule<MainActivity>()

    private fun menu(name: String) {
        val session = AdminSessionManager(InstrumentationRegistry.getInstrumentation().targetContext)
        assumeTrue("Requires an existing signed-in management session", session.getUser()?.role in listOf("ADMIN", "MANAGER"))
        compose.waitUntil(30000) { compose.onAllNodesWithContentDescription("Menu").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithContentDescription("Menu").performClick()
        compose.onNodeWithTag("admin-menu-list").performScrollToNode(hasText(name))
        compose.onNodeWithText(name).performClick()
    }

    @Test fun categoryAndProductFormsLoadLiveOptionsWithoutCreatingRecords() {
        menu("Categories")
        compose.onNodeWithText("Add category").performClick()
        compose.waitUntil(30000) { compose.onAllNodesWithText("Create category").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Name *").assertExists()
        compose.onNodeWithText("Cancel").performClick()
        menu("Products")
        compose.onNodeWithText("Add product").performClick()
        compose.waitUntil(30000) { compose.onAllNodesWithText("Create product").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("Product name *").assertExists()
        compose.onNodeWithText("SKU *").assertExists()
        compose.onNodeWithText("Cancel").performClick()
    }

    @Test fun inventoryAndInvoicesRenderLiveData() {
        menu("Inventory")
        compose.waitUntil(30000) { compose.onAllNodesWithText("Adjust inventory").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithText("No records on this page.").fetchSemanticsNodes().isNotEmpty() }
        if (compose.onAllNodesWithText("Adjust inventory").fetchSemanticsNodes().isNotEmpty()) {
            compose.onAllNodesWithText("Adjust inventory").onFirst().performScrollTo().performClick()
            compose.waitUntil(30000) { compose.onAllNodesWithText("Available quantity *").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Reserved quantity *").assertExists()
            compose.onNodeWithText("Cancel").performClick()
        }
        menu("Invoices")
        compose.waitUntil(30000) { compose.onAllNodesWithText("Order receipt and payment").fetchSemanticsNodes().isNotEmpty() || compose.onAllNodesWithText("No records on this page.").fetchSemanticsNodes().isNotEmpty() }
        if (compose.onAllNodesWithText("Order receipt and payment").fetchSemanticsNodes().isNotEmpty()) {
            compose.onAllNodesWithText("Order receipt and payment").onFirst().performScrollTo().performClick()
            compose.waitUntil(30000) { compose.onAllNodesWithText("Save receipt PDF").fetchSemanticsNodes().isNotEmpty() }
            compose.onNodeWithText("Order summary; not a separately numbered tax invoice.").assertExists()
            compose.onNodeWithText("Close").performClick()
        }
    }

    @Test fun receiptPdfHandlesMultiplePages() {
        val items = JSONArray()
        repeat(150) { index -> items.put(JSONObject().put("product", JSONObject().put("name", "Receipt fixture item $index")).put("quantity", 1).put("unitPrice", 10).put("gstRate", 5)) }
        val order = JSONObject().put("marketplaceOrderId", "QA-RECEIPT").put("customerName", "Test customer").put("orderItems", items).put("totalAmount", 1575).put("taxAmount", 75)
        val output = ByteArrayOutputStream()
        ReceiptPdf.write(order, output)
        assertEquals("%PDF", output.toByteArray().take(4).map { it.toInt().toChar() }.joinToString(""))
        assertTrue(output.size() > 1000)
    }
}
