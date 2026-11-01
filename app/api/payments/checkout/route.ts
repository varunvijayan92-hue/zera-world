import { AUTH_COOKIE, getCurrentUser } from "@/lib/auth";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createPaymentSession } from "@/lib/payment";
import { gatewayError, GatewayError } from "@/lib/razorpay";
import { priceCheckout } from "@/lib/checkout";
import { checkoutRequestSchema } from "@/lib/validators";
import { buildSupplierOrderEmailText, emailDelivery } from "@/lib/email";

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
        include: { inventory: { where: { status: "AVAILABLE" } } },
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

    try {
      const supplierIds = [...new Set(result.order.orderItems.map((item) => item.supplierId).filter((id): id is string => Boolean(id)))];
      if (supplierIds.length > 0) {
        const suppliers = await prisma.supplier.findMany({
          where: { id: { in: supplierIds } },
          select: { id: true, companyName: true, email: true, contactName: true },
        });
        const byId = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
        const itemsBySupplier = new Map<string, typeof result.order.orderItems>();
        for (const item of result.order.orderItems) {
          if (!item.supplierId) continue;
          const existing = itemsBySupplier.get(item.supplierId) || [];
          existing.push(item);
          itemsBySupplier.set(item.supplierId, existing);
        }
        for (const [supplierId, items] of itemsBySupplier) {
          const supplier = byId.get(supplierId);
          if (!supplier || !supplier.email) continue;
          const productIds = items.map((item) => item.productId).filter((id): id is string => Boolean(id));
          const productDetails = await prisma.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, sku: true, sellingPrice: true, gstRate: true, handlingCharge: true },
          });
          const productMap = new Map(productDetails.map((product) => [product.id, product]));
          const itemRows = items.map((item) => {
            const productId = item.productId;
            if (!productId) return null;
            const product = productMap.get(productId);
            const unitPrice = Number(product?.sellingPrice ?? item.unitPrice ?? 0);
            const gstRate = Number(product?.gstRate ?? item.gstRate ?? 0);
            const handlingCharge = Number(product?.handlingCharge ?? item.handlingCharge ?? 0);
            const lineSubtotal = unitPrice * item.quantity;
            const lineTax = lineSubtotal * gstRate / 100;
            const lineHandling = handlingCharge * item.quantity;
            const lineTotal = lineSubtotal + lineTax + lineHandling;
            return {
              productName: product?.name || item.marketplaceSku || "Product",
              sku: String(product?.sku ?? item.marketplaceSku ?? productId ?? "N/A"),
              quantity: item.quantity,
              unitPrice,
              gstRate,
              handlingCharge,
              lineTotal,
            };
          }).filter((row): row is { productName: string; sku: string; quantity: number; unitPrice: number; gstRate: number; handlingCharge: number; lineTotal: number } => row !== null);
          const supplierTotals = itemRows.reduce((total, item) => {
            const lineSubtotal = item.unitPrice * item.quantity;
            const lineTax = lineSubtotal * item.gstRate / 100;
            const lineHandling = item.handlingCharge * item.quantity;
            total.subtotal += lineSubtotal;
            total.taxes += lineTax;
            total.handling += lineHandling;
            total.total += lineSubtotal + lineTax + lineHandling;
            return total;
          }, { subtotal: 0, taxes: 0, handling: 0, total: 0 });
          const supplierOrderText = buildSupplierOrderEmailText({
            supplierCompany: supplier.companyName,
            supplierContact: supplier.contactName,
            orderId: result.order.marketplaceOrderId,
            customer: { fullName: shippingAddress.fullName, email: shippingAddress.email, phone: shippingAddress.phone },
            shippingAddress,
            items: itemRows,
            totals: {
              subtotal: supplierTotals.subtotal,
              taxes: supplierTotals.taxes,
              handling: supplierTotals.handling,
              shipping: Number(result.order.shippingAmount),
              total: supplierTotals.total + Number(result.order.shippingAmount),
            },
          });
          await emailDelivery.send({
            to: supplier.email,
            subject: `New order for ${supplier.companyName} - ${result.order.marketplaceOrderId}`,
            text: supplierOrderText,
          }, `supplier-order/${result.order.id}/${supplierId}`);
        }
      }
    } catch (error) {
      console.error("Supplier order email could not be sent", error);
    }

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
