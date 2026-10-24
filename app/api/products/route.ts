import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProductToMarketplaces } from "@/lib/marketplace";
import { productSchema } from "@/lib/validators";

export async function GET() {
  const products = await prisma.product.findMany({
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: products });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid product payload." },
        { status: 400 }
      );
    }

    const normalizedImageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls
      : typeof body.imageUrls === "string"
        ? body.imageUrls.split(",").map((value: string) => value.trim()).filter(Boolean)
        : [];

    const product = await prisma.product.create({
      data: {
        ...parsed.data,
        imageUrls: normalizedImageUrls,
        status: parsed.data.status || "DRAFT",
        costPrice: parsed.data.costPrice ?? null,
        sellingPrice: parsed.data.sellingPrice ?? null,
      },
    });

    const marketplaceSync = syncProductToMarketplaces(product);

    return NextResponse.json({ data: product, marketplaceSync }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Product creation failed." },
      { status: 500 }
    );
  }
}
