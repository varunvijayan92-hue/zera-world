import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyRazorpaySignature } from "@/lib/payment";
import { gatewayError, resolveRazorpayCredentials, razorpayGateway } from "@/lib/razorpay";
import { nextPaymentStatus, paymentMatches } from "@/lib/payment-state";
import { queuePaidCjOrder } from "@/lib/cj-fulfilment-queue";

const verificationSchema = z.object({
  razorpay_payment_id: z.string().regex(/^pay_[a-zA-Z0-9]+$/),
  razorpay_order_id: z.string().regex(/^order_[a-zA-Z0-9]+$/),
  razorpay_signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export async function POST(request: Request) {
  const parsed = verificationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, message: "Missing or invalid payment verification fields." }, { status: 400 });
  const response = parsed.data;
  try {
    const { keySecret } = await resolveRazorpayCredentials();
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { provider: "RAZORPAY", gatewayOrderId: response.razorpay_order_id },
    });
    if (!transaction?.gatewayOrderId) return NextResponse.json({ success: false, message: "Payment order was not found." }, { status: 400 });
    // Use the server's saved order ID to construct the signature payload.
    if (!verifyRazorpaySignature({
      payload: `${transaction.gatewayOrderId}|${response.razorpay_payment_id}`,
      signature: response.razorpay_signature.toLowerCase(), secret: keySecret,
    })) {
      return NextResponse.json({ success: false, message: "Payment signature mismatch." }, { status: 400 });
    }

    // A Checkout signature authenticates the response. Fetch capture status and
    // match the original amount/currency before confirming a paid order.
    const payment = await razorpayGateway.fetchPayment(response.razorpay_payment_id);
    if (payment.order_id !== transaction.gatewayOrderId || !paymentMatches(transaction, { ...payment, amount: Number(payment.amount) })) {
      return NextResponse.json({ success: false, message: "Payment details do not match the order." }, { status: 400 });
    }
    if (payment.status !== "captured" && payment.status !== "authorized") {
      return NextResponse.json({ success: false, message: "Payment has not been authorized or captured." }, { status: 400 });
    }
    const saved = await prisma.$transaction(async (tx) => {
      const current = await tx.paymentTransaction.findUniqueOrThrow({ where: { id: transaction.id } });
      if (!paymentMatches(current, { ...payment, amount: Number(payment.amount) }) || ["CANCELLED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(current.paymentStatus)) {
        return null;
      }
      const status = nextPaymentStatus(current.paymentStatus, payment.status === "captured" ? "payment.captured" : "payment.authorized");
      if (status) {
        await tx.paymentTransaction.update({ where: { id: current.id }, data: {
          gatewayPaymentId: payment.id, paymentStatus: status, verificationTimestamp: new Date(),
        } });
      }
      if ((status || current.paymentStatus) === "PAID") {
        await tx.customerOrder.updateMany({ where: { id: current.orderId, status: "PENDING" }, data: { status: "CONFIRMED" } });
        await queuePaidCjOrder(tx, current.orderId);
      }
      return { orderId: current.orderId, status: status || current.paymentStatus };
    }, { isolationLevel: "Serializable" });
    if (!saved) return NextResponse.json({ success: false, message: "This payment cannot confirm the order." }, { status: 400 });
    return NextResponse.json({ success: true, order_id: saved.orderId, payment_status: saved.status });
  } catch (error) {
    const failure = gatewayError(error);
    return NextResponse.json({ success: false, message: failure.message }, { status: failure.status });
  }
}
