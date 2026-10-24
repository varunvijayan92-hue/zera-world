import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createPaymentSession } from "@/lib/payment";
import { checkoutRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = checkoutRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid checkout payload." },
        { status: 400 }
      );
    }

    const cartItems = parsed.data.cart;
    const productIds = cartItems.map((item) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { supplierProductMappings: true },
    });

    const productLookup = new Map(products.map((product) => [product.id, product]));
    const missingProducts = cartItems.filter((item) => !productLookup.has(item.productId));
    if (missingProducts.length) {
      return NextResponse.json({ message: "One or more products are no longer available." }, { status: 400 });
    }

    const subtotal = cartItems.reduce((sum, item) => {
      const product = productLookup.get(item.productId)!;
      const unitPrice = Number(product.sellingPrice ?? 0);
      return sum + unitPrice * item.quantity;
    }, 0);

    const taxes = subtotal * 0.05;
    const shippingCharges = subtotal > 0 ? 120 : 0;
    const total = subtotal + shippingCharges + taxes;
    const currency = "INR";
    const idempotencyKey = parsed.data.idempotencyKey || `checkout_${Date.now()}`;

    const existingTransaction = await prisma.paymentTransaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTransaction) {
      return NextResponse.json({ data: { payment: existingTransaction, order: null, note: "Duplicate checkout submission blocked." } }, { status: 200 });
    }

    const order = await prisma.customerOrder.create({
      data: {
        marketplaceType: "AMAZON",
        marketplaceOrderId: `ORDER-${Date.now()}`,
        customerName: parsed.data.shippingAddress.fullName,
        status: "PENDING",
        subtotal: subtotal,
        shippingAmount: shippingCharges,
        totalAmount: total,
        orderDate: new Date(),
        orderItems: {
          create: cartItems.map((item) => ({
            productId: item.productId,
            marketplaceSku: item.sku,
            quantity: item.quantity,
            unitPrice: Number(productLookup.get(item.productId)?.sellingPrice ?? 0),
            status: "PENDING",
          })),
        },
      },
      include: { orderItems: true },
    });

    const payment = await createPaymentSession({
      amount: total,
      currency,
      orderId: order.id,
      customerName: parsed.data.shippingAddress.fullName,
      email: parsed.data.shippingAddress.email,
      provider: parsed.data.paymentMethod === "manual" ? "manual" : "razorpay",
    });

    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        provider: payment.provider === "razorpay" ? "RAZORPAY" : payment.provider === "stripe" ? "STRIPE" : "MANUAL",
        gatewayOrderId: payment.gatewayOrderId || null,
        gatewayPaymentId: null,
        amount: total,
        currency,
        paymentStatus: "PENDING",
        idempotencyKey,
        verificationTimestamp: null,
        refundReference: null,
        refundStatus: "NOT_REQUESTED",
      },
    });

    return NextResponse.json({
      data: {
        order,
        payment,
        amount: {
          subtotal,
          shippingCharges,
          taxes,
          total,
          currency,
        },
        address: parsed.data.shippingAddress,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Payment session creation failed." },
      { status: 500 }
    );
  }
}
