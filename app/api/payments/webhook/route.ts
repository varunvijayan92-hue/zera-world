import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpaySignature } from "@/lib/payment";
import { nextPaymentStatus, paymentMatches } from "@/lib/payment-state";
import { paymentWebhookSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ message: "Webhook verification is not configured." }, { status: 503 });
  const rawBody = await request.text();
  if (!verifyRazorpaySignature({ payload: rawBody, secret, signature: request.headers.get("x-razorpay-signature") || "" })) {
    return NextResponse.json({ message: "Invalid payment webhook signature." }, { status: 400 });
  }
  let body: unknown;
  try { body = JSON.parse(rawBody); } catch {
    return NextResponse.json({ message: "Invalid webhook JSON." }, { status: 400 });
  }
  const parsed = paymentWebhookSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
  const { event, payload } = parsed.data;
  if (!["payment.captured", "payment.authorized", "payment.failed"].includes(event)) {
    return NextResponse.json({ ok: true, ignored: true });
  }
  const payment = payload.payment.entity;
  if (!payment.order_id) return NextResponse.json({ message: "Missing gateway order ID." }, { status: 400 });
  const eventId = request.headers.get("x-razorpay-event-id") || createHash("sha256").update(rawBody).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentTransaction.findFirst({
        where: { provider: "RAZORPAY", gatewayOrderId: payment.order_id },
      });
      // A webhook can race the checkout's gateway-order update: ask for retry.
      if (!existing) return { status: 503, message: "Payment record is not ready. Retry delivery." };
      if (!paymentMatches(existing, payment)) return { status: 400, message: "Payment details do not match checkout." };
      if (existing.webhookEventId === eventId) return { status: 200, duplicate: true };
      const paymentStatus = nextPaymentStatus(existing.paymentStatus, event);
      if (!paymentStatus) return { status: 200, ignored: true };
      await tx.paymentTransaction.update({ where: { id: existing.id }, data: {
        paymentStatus, gatewayPaymentId: payment.id, webhookEventId: eventId, verificationTimestamp: new Date(),
      } });
      if (paymentStatus === "PAID") {
        await tx.customerOrder.updateMany({
          where: { id: existing.orderId, status: "PENDING" }, data: { status: "CONFIRMED" },
        });
      }
      return { status: 200 };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ ok: result.status === 200, ...result }, { status: result.status });
  } catch (error) {
    console.error("Payment webhook failed", error);
    return NextResponse.json({ message: "Webhook processing failed. Retry delivery." }, { status: 500 });
  }
}
