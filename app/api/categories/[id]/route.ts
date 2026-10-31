import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { categorySchema } from "@/lib/category";
import { prisma } from "@/lib/prisma";

type Context = { params: Promise<{ id: string }> };
function refresh() { for (const path of ["/", "/products", "/admin/categories", "/admin/products"]) revalidatePath(path); }

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = categorySchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ message: "Invalid category details." }, { status: 400 });
  const { id } = await context.params;
  try {
    const category = await prisma.$transaction(async (tx) => {
      const current = await tx.storeCategory.findUnique({ where: { id } });
      if (!current) return null;
      const updated = await tx.storeCategory.update({ where: { id }, data: parsed.data });
      if (updated.name !== current.name) await tx.product.updateMany({ where: { categoryId: id }, data: { category: updated.name } });
      return updated;
    });
    if (!category) return NextResponse.json({ message: "Category not found." }, { status: 404 });
    refresh();
    return NextResponse.json({ data: category });
  } catch { return NextResponse.json({ message: "Category could not be changed. Check that its name and slug are unique." }, { status: 409 }); }
}

export async function DELETE(_request: Request, context: Context) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    const result = await prisma.$transaction(async (tx) => {
      if (await tx.product.count({ where: { categoryId: id } })) return false;
      await tx.storeCategory.delete({ where: { id } });
      return true;
    }, { isolationLevel: "Serializable" });
    if (!result) return NextResponse.json({ message: "Move the products to another category before deleting this category." }, { status: 409 });
    refresh();
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ message: "Category could not be deleted. Refresh and try again." }, { status: 409 }); }
}
