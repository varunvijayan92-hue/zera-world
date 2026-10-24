import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupplierOrderWorkflow, routeMarketplaceOrderToSuppliers } from "@/lib/marketplace";
import { orderSchema } from "@/lib/validators";

export async function GET() {
  const orders = await prisma.customerOrder.findMany({
    include: { orderItems: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: orders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = orderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid order payload." },
        { status: 400 }
      );
    }

    const order = await prisma.customerOrder.create({
      data: {
        marketplaceType: parsed.data.marketplaceType,
        marketplaceOrderId: parsed.data.marketplaceOrderId,
        customerName: parsed.data.customerName || "Guest",
        status: parsed.data.status || "PENDING",
        totalAmount: parsed.data.totalAmount,
        orderItems: {
          create: parsed.data.items.map((item) => ({
            productId: item.productId || null,
            marketplaceSku: item.marketplaceSku || null,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            status: "PENDING",
          })),
        },
      },
      include: { orderItems: true },
    });

    const supplierDispatches = routeMarketplaceOrderToSuppliers({
      id: order.id,
      marketplaceType: order.marketplaceType,
      marketplaceOrderId: order.marketplaceOrderId,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount ?? parsed.data.totalAmount ?? 0),
      status: order.status,
      shippingAddress: parsed.data.shippingAddress,
      supplierAssignments: parsed.data.supplierAssignments,
    });

    const supplierOrderWorkflow = createSupplierOrderWorkflow({
      orderId: order.id,
      marketplaceType: order.marketplaceType,
      supplierId: parsed.data.supplierAssignments?.[0]?.supplierId || "supplier-pending",
      supplierName: parsed.data.supplierAssignments?.[0]?.supplierName || "Unassigned Supplier",
      productId: parsed.data.items?.[0]?.productId || "product-pending",
      totalAmount: Number(order.totalAmount ?? parsed.data.totalAmount ?? 0),
      shippingDestination: parsed.data.shippingAddress?.country || "India",
      mapping: {
        mappingStatus: "ACTIVE",
        supplierAvailability: "IN_STOCK",
        estimatedDeliveryDays: 7,
        externalProductId: "SUP-AVAILABLE",
        supplierSku: parsed.data.items?.[0]?.marketplaceSku || "SUP-DEFAULT",
        purchaseCost: Number(parsed.data.totalAmount ?? 0) * 0.6,
        shippingCost: Number(parsed.data.shippingAddress?.pincode ? 60 : 0),
      },
      supplier: {
        connectionStatus: "PENDING",
        autoOrderProcessing: false,
        integrationType: "MANUAL",
      },
    });

    return NextResponse.json({ data: order, supplierDispatches, supplierOrderWorkflow }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Order creation failed." },
      { status: 500 }
    );
  }
}
