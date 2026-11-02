import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { CatalogError, resolveProductCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import { productSchema } from "@/lib/validators";
import { saveProductExtras } from "@/lib/product-pricing";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { deleteUnusedProduct } from "@/lib/product-deletion";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = productSchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Check the product details." }, { status: 400 });
  const { id } = await params;
  try {
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ message: "Product not found." }, { status: 404 });
    const { categoryId, category, availableQty, imageUrls, mrp, hsnCode, deliveryCharge, ...data } = parsed.data;
    if (availableQty !== undefined || imageUrls !== undefined) throw new CatalogError("Use the inventory or photo tools to change stock or photos.");
    if ((data.status || current.status) === "ACTIVE" && Number(data.sellingPrice ?? current.sellingPrice) <= 0) throw new CatalogError("An active product needs a selling price greater than zero.");
    const categoryFields = await resolveProductCategory(categoryId, category);
    const product = await prisma.$transaction(async tx => {
      const saved = await tx.product.update({ where: { id }, data: { ...data, ...categoryFields, ...(deliveryCharge !== undefined ? { deliveryCharge } : {}) } });
      return { ...saved, ...await saveProductExtras(tx, id, { mrp, hsnCode }, saved.sellingPrice) };
    });
    for (const path of ["/", "/products", `/products/${id}`, "/admin/products"]) revalidatePath(path);
    return NextResponse.json({ data: product });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Product could not be saved. Check that its SKU is unique." }, { status: 409 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(actor.role)) return NextResponse.json({ message: "Management access required." }, { status: 403 });
  const { id } = await params;
  try {
    await deleteUnusedProduct(id, actor.id);
    for (const path of ["/", "/products", "/new-arrivals", `/products/${id}`, "/admin/products", "/sitemap.xml"]) revalidatePath(path);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Product could not be deleted. Refresh and try again, or archive it if it has linked records." }, { status: 409 });
  }
}
