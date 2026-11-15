package `in`.zerasworld.admin

import android.graphics.Paint
import android.graphics.pdf.PdfDocument
import org.json.JSONObject
import java.io.OutputStream
import java.util.Locale

object ReceiptPdf {
    fun write(order: JSONObject, output: OutputStream) {
        val document = PdfDocument()
        val paint = Paint().apply { textSize = 11f }
        var pageNumber = 1
        var page = document.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNumber).create())
        var y = 40f
        fun line(text: String) {
            // Wrap long names and addresses, and paginate without clipping line items.
            var remaining = text
            do {
                if (y > 800) { document.finishPage(page); pageNumber++; page = document.startPage(PdfDocument.PageInfo.Builder(595, 842, pageNumber).create()); y = 40f }
                val length = if (remaining.isEmpty()) 0 else paint.breakText(remaining, true, 515f, null).coerceAtLeast(1)
                page.canvas.drawText(remaining.take(length), 40f, y, paint); y += 17f
                remaining = remaining.drop(length)
            } while (remaining.isNotEmpty())
        }
        fun money(key: String) = String.format(Locale.US, "INR %.2f", order.optDouble(key, 0.0))
        try {
            line("Zera's World - Order receipt")
            line("Order summary; not a separately numbered tax invoice.")
            line("Order: ${order.optString("marketplaceOrderId")}")
            line("Date: ${order.optString("createdAt").take(10)}")
            line("Customer: ${order.optString("customerName")}")
            order.optJSONObject("shippingAddress")?.let { address ->
                line(listOf("fullName", "addressLine1", "addressLine2", "city", "state", "pincode", "country", "phone").map { address.optString(it).takeUnless { value -> value == "null" }.orEmpty() }.filter { it.isNotBlank() }.joinToString(", "))
            }
            line("")
            val items = order.optJSONArray("orderItems")
            var subtotal = 0.0
            if (items != null) for (index in 0 until items.length()) {
                val item = items.getJSONObject(index)
                val name = item.optJSONObject("product")?.optString("name") ?: item.optString("marketplaceSku", "Item")
                subtotal += item.optDouble("unitPrice", 0.0) * item.optInt("quantity")
                line(name)
                line("Qty ${item.optInt("quantity")} x INR ${item.optString("unitPrice")} | GST ${item.optString("gstRate", "0")}%")
            }
            line("")
            line("Items subtotal: " + if (order.isNull("subtotal")) String.format(Locale.US, "INR %.2f", subtotal) else money("subtotal"))
            line("GST: ${money("taxAmount")}")
            line("Delivery: ${money("shippingAmount")}")
            line("Handling: ${money("handlingAmount")}")
            line("Order total: ${money("totalAmount")}")
            order.optJSONArray("payments")?.let { payments -> for (index in 0 until payments.length()) {
                val payment = payments.getJSONObject(index); line("Payment: ${payment.optString("provider")} / ${payment.optString("paymentStatus")}")
            } }
            document.finishPage(page)
            document.writeTo(output)
        } finally { document.close() }
    }
}
