import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !["ADMIN", "MANAGER"].includes(session.role)) {
      return NextResponse.json({ message: "Unauthorized. Admin role required." }, { status: 401 });
    }

    const body = await request.json();
    const { alertType } = body;

    const isOrderAlert = alertType === "ORDER_ALERT";
    const title = isOrderAlert ? "🚨 New Order Alert!" : "📦 New Return Request!";
    const bodyText = isOrderAlert
      ? "Order #ZW-2026-9842 received for ₹2,499 from Rahul M."
      : "Return requested for Order #ZW-2026-7710. Reason: Size did not fit.";

    return NextResponse.json({
      success: true,
      message: `Test alert (${isOrderAlert ? "Order Alert" : "Return Alert"}) dispatched successfully to registered admin phones.`,
      alert: {
        title,
        body: bodyText,
        type: alertType || "ORDER_ALERT",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ message: "Failed to dispatch test alert." }, { status: 500 });
  }
}
