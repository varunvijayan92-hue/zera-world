import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";

    if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
      return NextResponse.json({ message: "Webhook verification is not configured." }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature);
    const signatureBuffer = Buffer.from(signature);

    if (expectedBuffer.length !== signatureBuffer.length) {
      return NextResponse.json({ message: "Invalid payment webhook signature." }, { status: 400 });
    }

    const isValid = crypto.timingSafeEqual(expectedBuffer, signatureBuffer);

    if (!isValid) {
      return NextResponse.json({ message: "Invalid payment webhook signature." }, { status: 400 });
    }

    const body = JSON.parse(rawBody || "{}");
    const eventType = body?.event;
    const payment = body?.payload?.payment?.entity;

    if (!eventType || !payment?.id) {
      return NextResponse.json({ message: "Webhook payload is invalid." }, { status: 400 });
    }

    const existing = await prisma.paymentTransaction.findFirst({
      where: { gatewayPaymentId: payment.id },
    });

    if (existing?.webhookEventId === body.id) {
      return NextResponse.json({ ok: true, duplicate: true, received: eventType });
    }

    const order = await prisma.customerOrder.findUnique({ where: { id: existing?.orderId || "" } });
    const paymentStatus = eventType === "payment.captured" ? "PAID" : eventType === "payment.failed" ? "FAILED" : eventType === "payment.authorized" ? "AUTHORIZED" : "PENDING";

    await prisma.paymentTransaction.updateMany({
      where: { gatewayPaymentId: payment.id },
      data: {
        paymentStatus,
        gatewayPaymentId: payment.id,
        webhookEventId: body.id || null,
        verificationTimestamp: new Date(),
      },
    });

    if (order && paymentStatus === "PAID") {
      await prisma.customerOrder.update({
        where: { id: order.id },
        data: { status: "CONFIRMED" },
      });
    }

    return NextResponse.json({
      ok: true,
      received: eventType,
      message: "Payment webhook received and queued for processing.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Webhook processing failed." },
      { status: 500 }
    );
  }
}
