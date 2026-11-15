import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { dispatchAlert } from "@/lib/notifications";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER", "SUPPLIER"].includes(session.role)) {
      return NextResponse.json({ message: "Unauthorized. Admin or Supplier role required." }, { status: 401 });
    }

    const body = await request.json();
    const { alertType, fcmToken } = body;

    let title = "🚨 New Order Alert!";
    let bodyText = "Order #ZW-2026-9842 received for ₹2,499 from Rahul M.";
    const normalizedType = alertType || "ORDER_ALERT";

    if (normalizedType === "RETURN_ALERT") {
      title = "📦 New Return Request!";
      bodyText = "Return requested for Order #ZW-2026-7710. Reason: Size did not fit.";
    } else if (normalizedType === "PAYMENT_ALERT") {
      title = "💰 Payment Received!";
      bodyText = "Payment of ₹2,499 confirmed for Order #ZW-2026-9842 via Razorpay.";
    }

    const dispatchResult = await dispatchAlert({
      type: normalizedType as "ORDER_ALERT" | "RETURN_ALERT" | "PAYMENT_ALERT",
      title,
      body: bodyText,
      data: {
        alertType: normalizedType,
        orderId: normalizedType === "ORDER_ALERT" ? "order_test_9842" : undefined,
        returnId: normalizedType === "RETURN_ALERT" ? "ret_test_7710" : undefined,
        paymentId: normalizedType === "PAYMENT_ALERT" ? "pay_test_9842" : undefined,
        amount: "2499.00",
      },
      targetRole: session.role === "SUPPLIER" ? "SUPPLIER" : "ALL",
      targetUserId: fcmToken ? undefined : undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Test alert (${normalizedType}) dispatched to ${dispatchResult.recipientCount} registered devices.`,
      alert: {
        title,
        body: bodyText,
        type: normalizedType,
        timestamp: new Date().toISOString(),
      },
      recipients: dispatchResult.recipientCount,
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to dispatch test alert." }, { status: 500 });
  }
}
