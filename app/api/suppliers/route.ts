import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { supplierSchema } from "@/lib/validators";

export async function GET() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: suppliers });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supplierSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid supplier payload." },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        ...parsed.data,
        status: parsed.data.status || "ACTIVE",
        minOrderQty: parsed.data.minOrderQty ?? null,
        leadTimeDays: parsed.data.leadTimeDays ?? null,
        shippingCharges: parsed.data.shippingCharges ?? null,
      },
    });

    return NextResponse.json({ data: supplier }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Supplier creation failed." },
      { status: 500 }
    );
  }
}
