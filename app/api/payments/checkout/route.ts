import { AccessError } from "@/lib/portal-access";
import { debitGiftCard } from "@/lib/gift-card-payment";
import { cashOnDeliveryAvailable, codShippingShare } from "@/lib/cash-on-delivery";
import { isSameOriginRequest } from "@/lib/request-origin";
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

function codResponse(order: { id: string; marketplaceOrderId: string; status: string; totalAmount: unknown }, repeated = false, paymentStatus = "PENDING") {
  return NextResponse.json({ order_id: null, amount: Math.round(Number(order.totalAmount) * 100), currency: "INR", payment_status: paymentStatus, data: { order: { id: order.id, marketplaceOrderId: order.marketplaceOrderId, status: order.status, totalAmount: order.totalAmount }, payment: { provider: "COD", status: paymentStatus } } }, { status: repeated ? 200 : 201 });
}

function giftCardResponse(order: { id: string; marketplaceOrderId: string; status: string; totalAmount: unknown }, repeated = false) {
  return NextResponse.json({ order_id: null, amount: Math.round(Number(order.totalAmount) * 100), currency: "INR", payment_status: "PAID", data: { order: { id: order.id, marketplaceOrderId: order.marketplaceOrderId, status: order.status, totalAmount: order.totalAmount }, payment: { provider: "GIFT_CARD", status: "PAID" } } }, { status: repeated ? 200 : 201 });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const parsed = checkoutRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message || "Invalid checkout." }, { status: 400 });
  }
  const user = request.headers.get("cookie")?.includes(AUTH_COOKIE) ? await getCurrentUser() : null;
  if (!user || user.role !== "CUSTOMER") return NextResponse.json({ message: "Please sign in as a customer to continue to payment." }, { status: 401 });
  const { cart, shippingAddress, paymentMethod } = parsed.data;
  if (["cod", "gift_card"].includes(paymentMethod) && !parsed.data.idempotencyKey) return NextResponse.json({ message: "Checkout reference missing. Refresh the payment page and try again." }, { status: 400 });
  if (paymentMethod === "gift_card" && !parsed.data.giftCardCode) return NextResponse.json({ message: "Choose your gift card." }, { status: 400 });
  const idempotencyKey = parsed.data.idempotencyKey || randomUUID();
  try {
    // Commit the order and its unique submission key together.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.paymentTransaction.findUnique({ where: { idempotencyKey } });
      if (existing) return null;
      const products = await tx.product.findMany({
        where: { id: { in: cart.map((item) => item.productId) } },
        include: { supplier: { select: { status: true, sourceType: true } }, inventory: { where: { status: "AVAILABLE" } } },
      });
      const amount = priceCheckout(cart, products);
      if (paymentMethod === "cod" && !cashOnDeliveryAvailable(products)) throw new GatewayError("Cash on delivery is not available for every item in this cart. Choose prepaid payment or update your cart.", 400);
      if (parsed.data.expectedTotalPaise !== undefined && parsed.data.expectedTotalPaise !== Math.round(amount.total * 100)) {
        throw new GatewayError("The order amount has changed. Go back to review and confirm the updated amount.", 409);
      }
      const giftCardId = paymentMethod === "gift_card" ? await debitGiftCard(tx, user.id, parsed.data.giftCardCode!, amount.total) : null;
      const order = await tx.customerOrder.create({
        data: {
          salesChannel: "WEBSITE",
          marketplaceType: "WEBSITE",
          marketplaceOrderId: `ORDER-${randomUUID()}`,
          customerId: user?.role === "CUSTOMER" ? user.id : null,
          customerName: shippingAddress.fullName,
          shippingAddress,
          status: ["cod", "gift_card"].includes(paymentMethod) ? "CONFIRMED" : "PENDING",
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
            productId: item.productId, selectedColor: item.selectedColor || null, selectedSize: item.selectedSize || null,
            status: paymentMethod === "cod" ? "CONFIRMED" : "PENDING",
            marketplaceSku: products.find((product) => product.id === item.productId)!.sku,
            quantity: item.quantity,
            unitPrice: Number(products.find((product) => product.id === item.productId)!.sellingPrice),
          })) },
        },
        include: { orderItems: true },
      });
      const transaction = await tx.paymentTransaction.create({ data: {
        orderId: order.id,
        provider: paymentMethod === "gift_card" ? "GIFT_CARD" : paymentMethod === "cod" ? "COD" : paymentMethod === "manual" ? "MANUAL" : "RAZORPAY",
        amount: amount.total,
        currency: amount.currency,
        paymentStatus: paymentMethod === "gift_card" ? "PAID" : paymentMethod === "cod" ? "PENDING" : "CREATED",
        ...(giftCardId ? { giftCardId } : {}),
        idempotencyKey,
      } });
      if (giftCardId) await tx.auditLog.create({ data: { userId: user.id, action: "REDEEM_GIFT_CARD", entityType: "CustomerVoucher", entityId: giftCardId, details: { orderId: order.id, amount: amount.total } } });
      return { order, transaction, amount };
    }, { isolationLevel: "Serializable" });
    if (!result) {
      if (["cod", "gift_card"].includes(paymentMethod)) {
        const previous = await prisma.paymentTransaction.findUnique({ where: { idempotencyKey } });
        const providerMatches = previous?.provider === (paymentMethod === "cod" ? "COD" : "GIFT_CARD");
        const giftMatches = paymentMethod !== "gift_card" || (previous?.giftCardId && await prisma.customerVoucher.findFirst({ where: { id: previous.giftCardId, customerId: user.id, code: parsed.data.giftCardCode }, select: { id: true } }));
        const order = providerMatches && giftMatches ? await prisma.customerOrder.findFirst({ where: { id: previous.orderId, customerId: user.id, status: { in: ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] } }, include: { orderItems: true } }) : null;
        const linesMatch = order && order.orderItems.length === cart.length && cart.every(item => order.orderItems.some(line => line.productId === item.productId && line.marketplaceSku === item.sku && (line.selectedColor || undefined) === item.selectedColor && (line.selectedSize || undefined) === item.selectedSize && line.quantity === item.quantity));
        const address = order?.shippingAddress as Record<string, unknown> | undefined;
        const addressMatches = address && Object.entries(shippingAddress).every(([key, value]) => address[key] === value);
        if (order && previous && (paymentMethod === "cod" ? ["PENDING", "PAID"].includes(previous.paymentStatus) : previous.paymentStatus === "PAID") && linesMatch && addressMatches && (parsed.data.expectedTotalPaise === undefined || parsed.data.expectedTotalPaise === Math.round(Number(order.totalAmount) * 100))) return paymentMethod === "gift_card" ? giftCardResponse(order, true) : codResponse(order, true, previous.paymentStatus);
      }
      return NextResponse.json({ message: "This checkout has already been submitted. Check your orders before trying again." }, { status: 409 });
    }

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
          const shippingShare = codShippingShare(result.order.shippingAmount, itemsBySupplier.keys(), supplierId);
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
            const unitPrice = Number(item.unitPrice ?? product?.sellingPrice ?? 0);
            const gstRate = Number(item.gstRate ?? product?.gstRate ?? 0);
            const handlingCharge = Number(item.handlingCharge ?? product?.handlingCharge ?? 0);
            const lineSubtotal = unitPrice * item.quantity;
            const lineTax = Math.round(Math.round(lineSubtotal * 100) * gstRate / 100) / 100;
            const lineHandling = handlingCharge * item.quantity;
            const lineTotal = lineSubtotal + lineTax + lineHandling;
            return {
              productName: [product?.name || item.marketplaceSku || "Product", item.selectedColor, item.selectedSize].filter(Boolean).join(" / "),
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
            const lineTax = Math.round(Math.round(lineSubtotal * 100) * item.gstRate / 100) / 100;
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
              shipping: shippingShare,
              total: supplierTotals.total + shippingShare,
            },
          });
          await emailDelivery.send({
            to: supplier.email,
            subject: `${paymentMethod === "cod" ? "Cash on delivery - " : ""}New order for ${supplier.companyName} - ${result.order.marketplaceOrderId}`,
            text: paymentMethod === "cod" ? `CASH ON DELIVERY: no online payment collected. Arrange COD collection through the courier when booking this supplier shipment.\n\n${supplierOrderText}` : supplierOrderText,
          }, `supplier-order/${result.order.id}/${supplierId}`);
        }
      }
    } catch (error) {
      console.error("Supplier order email could not be sent", error);
    }

    if (paymentMethod === "cod") return codResponse(result.order);
    if (paymentMethod === "gift_card") return giftCardResponse(result.order);

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
    if (error instanceof AccessError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof GatewayError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ message: "This checkout has already been submitted." }, { status: 409 });
    }
    if (error instanceof Error && ["Cart must", "One or more", "Product price", "Requested quantity"].some((prefix) => error.message.startsWith(prefix))) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return NextResponse.json({ message: "The order or gift-card balance changed. Please retry your saved checkout." }, { status: 409 });
    console.error(JSON.stringify({ event: "checkout_failed", code: error && typeof error === "object" && "code" in error ? String(error.code) : "UNKNOWN" }));
    return NextResponse.json({ message: "Checkout could not be created. Please contact support before retrying." }, { status: 500 });
  }
}
