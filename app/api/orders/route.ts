import { authorizeManagement } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSupplierOrderWorkflow, routeMarketplaceOrderToSuppliers } from "@/lib/marketplace";
import { orderSchema } from "@/lib/validators";

export async function GET() {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const orders = await prisma.customerOrder.findMany({
    include: { orderItems: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: orders });
}

export async function POST(request: Request) {
  const denied = await authorizeManagement();
  if (denied) return denied;
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
        salesChannel: parsed.data.marketplaceType,
        marketplaceType: parsed.data.marketplaceType,
        marketplaceOrderId: parsed.data.marketplaceOrderId,
        customerName: parsed.data.customerName || "Guest",
        shippingAddress: parsed.data.shippingAddress,
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
      marketplaceType: parsed.data.marketplaceType,
      marketplaceOrderId: order.marketplaceOrderId,
      customerName: order.customerName,
      totalAmount: Number(order.totalAmount ?? parsed.data.totalAmount ?? 0),
      status: order.status,
      shippingAddress: parsed.data.shippingAddress,
      supplierAssignments: parsed.data.supplierAssignments,
    });

    const supplierOrderWorkflow = createSupplierOrderWorkflow({
      orderId: order.id,
      marketplaceType: parsed.data.marketplaceType,
      supplierId: parsed.data.supplierAssignments?.[0]?.supplierId || "supplier-pending",
      supplierName: parsed.data.supplierAssignments?.[0]?.supplierName || "Unassigned Supplier",
      productId: parsed.data.items?.[0]?.productId || "product-pending",
      totalAmount: Number(order.totalAmount ?? parsed.data.totalAmount ?? 0),
      shippingDestination: parsed.data.shippingAddress?.country || "India",

    });

    return NextResponse.json({ data: order, supplierDispatches, supplierOrderWorkflow }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ message: "This marketplace order is already saved." }, { status: 409 });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Order creation failed." },
      { status: 500 }
    );
  }
}
