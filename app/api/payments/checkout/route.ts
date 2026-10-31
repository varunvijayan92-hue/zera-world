import { AUTH_COOKIE, getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentSession } from "@/lib/payment";
import { gatewayError, GatewayError } from "@/lib/razorpay";
import { priceCheckout } from "@/lib/checkout";
import { checkoutRequestSchema } from "@/lib/validators";

export async function POST(request: Request) {
  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid checkout." }, { status: 400 });
  }
  const user = request.headers.get("cookie")?.includes(AUTH_COOKIE) ? await getCurrentUser() : null;
  const { cart, shippingAddress, paymentMethod } = parsed.data;
  const idempotencyKey = parsed.data.idempotencyKey || randomUUID();
  try {
    // Commit the order and its unique submission key together.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) return null;
      const products = await tx.product.findMany({
        where: { id: { in: cart.map((item) => item.productId) } },
        include: { inventory: true },
      });
      const amount = priceCheckout(cart, products);
      if (parsed.data.expectedTotalPaise !== undefined && parsed.data.expectedTotalPaise !== Math.round(amount.total * 100)) {
        throw new GatewayError("The order amount has changed. Go back to review and confirm the updated amount.", 409);
      }
      const order = await tx.customerOrder.create({
        data: {
          marketplaceType: "AMAZON",
          marketplaceOrderId: `ORDER-${randomUUID()}`,
          customerId: user?.role === "CUSTOMER" ? user.id : null,
          customerName: shippingAddress.fullName,
          shippingAddress,
          status: "PENDING",
          subtotal: amount.subtotal, taxAmount: amount.taxes, handlingAmount: amount.handlingCharges,
          shippingAmount: amount.shippingCharges,
          totalAmount: amount.total,
          orderDate: new Date(),
          orderItems: { create: cart.map((item) => ({
            supplierId: products.find((product) => product.id === item.productId)!.supplierId,
            costPrice: products.find((product) => product.id === item.productId)!.costPrice,
            gstRate: products.find((product) => product.id === item.productId)!.gstRate,
            handlingCharge: products.find((product) => product.id === item.productId)!.handlingCharge,
            returnDays: products.find((product) => product.id === item.productId)!.returnDays,
            isReturnable: products.find((product) => product.id === item.productId)!.isReturnable,
            productId: item.productId,
            marketplaceSku: products.find((product) => product.id === item.productId)!.sku,
            quantity: item.quantity,
            unitPrice: Number(products.find((product) => product.id === item.productId)!.sellingPrice),
          })) },
        },
        include: { orderItems: true },
      });
      const transaction = await tx.paymentTransaction.create({ data: {
        orderId: order.id,
        provider: paymentMethod === "manual" ? "MANUAL" : "RAZORPAY",
        amount: amount.total,
        currency: amount.currency,
        paymentStatus: "CREATED",
        idempotencyKey,
      } });
      return { order, transaction, amount };
    });
    if (!result) return NextResponse.json({ message: "This checkout has already been submitted." }, { status: 409 });

    let payment;
    try {
      payment = await createPaymentSession({
      amount: result.amount.total, currency: result.amount.currency, orderId: result.order.id,
      customerName: shippingAddress.fullName, email: shippingAddress.email, provider: paymentMethod,
      });
    } catch (error) {
      await prisma.paymentTransaction.update({ where: { id: result.transaction.id }, data: { paymentStatus: "FAILED" } });
      throw gatewayError(error);
    }
    await prisma.$transaction([
      prisma.paymentTransaction.update({ where: { id: result.transaction.id }, data: {
        gatewayOrderId: payment.gatewayOrderId || null,
        paymentStatus: payment.status === "FAILED" ? "FAILED" : "PENDING",
      } }),
      ...(payment.status === "FAILED" ? [prisma.customerOrder.update({
        where: { id: result.order.id }, data: { status: "CANCELLED" },
      })] : []),
    ]);
    if (payment.status === "FAILED") return NextResponse.json({ message: payment.message }, { status: 502 });
    return NextResponse.json({
      order_id: payment.gatewayOrderId || null,
      amount: Math.round(result.amount.total * 100),
      currency: result.amount.currency,
      data: { order: { id: result.order.id, marketplaceOrderId: result.order.marketplaceOrderId, status: result.order.status, totalAmount: result.order.totalAmount }, payment, amount: result.amount },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof GatewayError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "This checkout has already been submitted." }, { status: 409 });
    }
    if (error instanceof Error && ["Cart must", "One or more", "Product price", "Requested quantity"].some((prefix) => error.message.startsWith(prefix))) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    console.error("Checkout failed", error);
    return NextResponse.json({ message: "Checkout could not be created. Please contact support before retrying." }, { status: 500 });
  }
}
