import { authorizeManagement } from "@/lib/api-auth";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createRefundRequest } from "@/lib/payment";
import { refundRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const denied = await authorizeManagement();
  if (denied) return denied;
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

    if (!["PAID", "PARTIALLY_REFUNDED"].includes(payment.paymentStatus) || !payment.amount || parsed.data.amount > Number(payment.amount)) {
      return NextResponse.json({ message: "Refund amount or payment status is invalid." }, { status: 400 });
    }

    if (payment.refundStatus === "PENDING" || payment.refundStatus === "SUCCESS") {
      return NextResponse.json({ message: "Duplicate or already-queued refund request blocked." }, { status: 409 });
    }

    // Claim before contacting the gateway so simultaneous requests cannot refund twice.
    const claimed = await prisma.paymentTransaction.updateMany({
      where: { id: payment.id, refundStatus: "NOT_REQUESTED", paymentStatus: "PAID" },
      data: { refundStatus: "PENDING" },
    });
    if (claimed.count !== 1) {
      return NextResponse.json({ message: "Refund already requested; review its gateway status." }, { status: 409 });
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
        refundStatus: result.status.toLowerCase() === "processed" ? "SUCCESS" : ["pending", "queued"].includes(result.status.toLowerCase()) ? "PENDING" : "FAILED",
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
