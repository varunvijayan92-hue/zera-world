import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { CatalogError, resolveProductCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validators";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = productSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Check the product details." }, { status: 400 });
  const { id } = await params;
  try {
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ message: "Product not found." }, { status: 404 });
    const { categoryId, category, availableQty, imageUrls, ...data } = parsed.data;
    if (availableQty !== undefined || imageUrls !== undefined) throw new CatalogError("Use the inventory or photo tools to change stock or photos.");
    if ((data.status || current.status) === "ACTIVE" && Number(data.sellingPrice ?? current.sellingPrice) <= 0) throw new CatalogError("An active product needs a selling price greater than zero.");
    const product = await prisma.product.update({ where: { id }, data: { ...data, ...await resolveProductCategory(categoryId, category) } });
    for (const path of ["/", "/products", `/products/${id}`, "/admin/products"]) revalidatePath(path);
    return NextResponse.json({ data: product });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Product could not be saved. Check that its SKU is unique." }, { status: 409 });
  }
}
