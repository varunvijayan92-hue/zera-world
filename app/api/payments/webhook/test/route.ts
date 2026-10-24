import crypto from "node:crypto";
import { NextResponse } from "next/server";

import { generateRazorpayWebhookSignature } from "@/lib/payment";

export async function POST(request: Request) {
  try {
    const input = await request.json().catch(() => ({}));
    const eventType = input?.eventType || "payment.captured";
    const paymentId = input?.paymentId || "pay_demo_123";
    const orderId = input?.orderId || "order_demo_123";
    const amount = Number(input?.amount ?? 1499);
    const currency = String(input?.currency || "INR").toUpperCase();
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "demo-local-webhook-secret";

    const payload = JSON.stringify({
      entity: "event",
      event: eventType,
      account_id: "acc_demo_123",
      created_at: Math.floor(Date.now() / 1000),
      contains: ["payment"],
      payload: {
        payment: {
          entity: {
            id: paymentId,
            entity: "payment",
            amount: Math.round(amount * 100),
            currency,
            order_id: orderId,
            status: "captured",
          },
        },
      },
    });

    const signature = generateRazorpayWebhookSignature({ payload, secret });

    return NextResponse.json({
      ok: true,
      mode: "sandbox-test",
      endpoint: "/api/payments/webhook",
      event: eventType,
      payload: JSON.parse(payload),
      headers: {
        "x-razorpay-signature": signature,
      },
      secret,
      note: "Use this sample payload and signature to validate the local webhook endpoint in sandbox/test mode.",
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to generate sandbox webhook payload." },
      { status: 500 }
    );
  }
}
