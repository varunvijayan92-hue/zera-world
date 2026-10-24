import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { validateSupplierProductMapping } from "@/lib/marketplace";
import { supplierProductMappingSchema } from "@/lib/validators";

export async function GET() {
  const mappings = await prisma.supplierProductMapping.findMany({
    include: { product: true, supplier: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: mappings });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supplierProductMappingSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid supplier mapping payload." },
        { status: 400 }
      );
    }

    const validation = validateSupplierProductMapping(parsed.data);
    if (!validation.isValid) {
      return NextResponse.json({ message: validation.message || "Supplier mapping is unavailable." }, { status: 400 });
    }

    const mapping = await prisma.supplierProductMapping.create({
      data: {
        ...parsed.data,
        lastStockCheckAt: parsed.data.lastStockCheckAt ? new Date(parsed.data.lastStockCheckAt) : null,
        purchaseCost: parsed.data.purchaseCost ?? null,
        shippingCost: parsed.data.shippingCost ?? null,
        estimatedDeliveryDays: parsed.data.estimatedDeliveryDays ?? null,
        mappingStatus: parsed.data.mappingStatus || "ACTIVE",
        isPreferred: Boolean(parsed.data.isPreferred),
        isFallback: Boolean(parsed.data.isFallback),
      },
    });

    return NextResponse.json({ data: mapping }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Supplier mapping could not be created." },
      { status: 500 }
    );
  }
}
