import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { inventorySchema } from "@/lib/validators";

export async function GET() {
  const inventory = await prisma.inventory.findMany({
    include: { product: true },
    orderBy: { lastUpdatedAt: "desc" },
  });

  return NextResponse.json({ data: inventory });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = inventorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid inventory payload." },
        { status: 400 }
      );
    }

    const warehouseId = parsed.data.warehouseId?.trim() || null;

    const existingInventory = warehouseId
      ? await prisma.inventory.findUnique({
          where: {
            productId_warehouseId: {
              productId: parsed.data.productId,
              warehouseId,
            },
          },
        })
      : await prisma.inventory.findFirst({
          where: { productId: parsed.data.productId },
        });

    const inventory = existingInventory
      ? await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            availableQty: parsed.data.availableQty,
            reservedQty: parsed.data.reservedQty,
            damagedQty: parsed.data.damagedQty,
            safetyStock: parsed.data.safetyStock,
            status: "AVAILABLE",
            lastUpdatedAt: new Date(),
          },
        })
      : await prisma.inventory.create({
          data: {
            productId: parsed.data.productId,
            warehouseId: warehouseId || null,
            supplierId: parsed.data.supplierId || null,
            availableQty: parsed.data.availableQty,
            reservedQty: parsed.data.reservedQty,
            damagedQty: parsed.data.damagedQty,
            safetyStock: parsed.data.safetyStock,
            status: "AVAILABLE",
          },
        });

    return NextResponse.json({ data: inventory }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Inventory update failed." },
      { status: 500 }
    );
  }
}
