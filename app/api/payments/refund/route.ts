import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createRefundRequest } from "@/lib/payment";
import { refundRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = refundRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid refund payload." },
        { status: 400 }
      );
    }

    const payment = await prisma.paymentTransaction.findFirst({
      where: { gatewayPaymentId: parsed.data.paymentId },
    });

    if (!payment) {
      return NextResponse.json({ message: "Payment record was not found for refund processing." }, { status: 404 });
    }

    if (payment.refundStatus === "PENDING" || payment.refundStatus === "SUCCESS") {
      return NextResponse.json({ message: "Duplicate or already-queued refund request blocked." }, { status: 409 });
    }

    const result = await createRefundRequest({
      paymentId: parsed.data.paymentId,
      amount: Number(parsed.data.amount),
      currency: payment.currency || "INR",
      reason: parsed.data.reason || "Customer refund request",
      notes: parsed.data.notes || "Requested by customer support",
    });

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        refundReference: result.refundId,
        refundStatus: result.status === "processed" ? "SUCCESS" : result.status === "pending" ? "PENDING" : "FAILED",
      },
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Refund processing failed." },
      { status: 500 }
    );
  }
}
