import { revalidatePath } from "next/cache";
import { CatalogError, resolveProductCategory } from "@/lib/catalog";
import { authorizeManagement } from "@/lib/api-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncProductToMarketplaces } from "@/lib/marketplace";
import { productSchema } from "@/lib/validators";
import { readProductExtras, saveProductExtras } from "@/lib/product-pricing";

export async function GET() {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const products = await prisma.product.findMany({
    include: { supplier: true },
    orderBy: { createdAt: "desc" },
  });

  const extras = await readProductExtras(products.map(product => product.id));
  return NextResponse.json({ data: products.map(product => ({ ...product, ...extras.get(product.id) })) });
}

export async function POST(request: Request) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  try {
    const body = await request.json();
    const parsed = productSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid product payload." },
        { status: 400 }
      );
    }

    const { categoryId, category, availableQty, mrp, hsnCode, deliveryCharge, imageUrls, ...data } = parsed.data;
    if (imageUrls.length) throw new CatalogError("Create the product first, then upload its photos to Cloudinary.");
    if (data.status === "ACTIVE" && Number(data.sellingPrice) <= 0) throw new CatalogError("An active product needs a selling price greater than zero.");
    const product = await prisma.$transaction(async tx => {
      const saved = await tx.product.create({
        data: {
          ...data, ...await resolveProductCategory(categoryId, category),
          status: data.status || "DRAFT",
          costPrice: data.costPrice ?? null, sellingPrice: data.sellingPrice ?? null,
          deliveryCharge: deliveryCharge ?? 0,
          ...(availableQty !== undefined ? { inventory: { create: { availableQty } } } : {}),
        },
      });
      return { ...saved, ...await saveProductExtras(tx, saved.id, { mrp, hsnCode }, saved.sellingPrice) };
    });
    for (const path of ["/", "/products", "/admin/products"]) revalidatePath(path);

    const marketplaceSync = syncProductToMarketplaces(product);

    return NextResponse.json({ data: product, marketplaceSync }, { status: 201 });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Product creation failed." },
      { status: 500 }
    );
  }
}
