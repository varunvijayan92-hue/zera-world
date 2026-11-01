import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { categorySchema } from "@/lib/category";
import { CategoryError, saveMenuCategory, deleteMenuCategory } from "@/lib/category-data";
import { isSameOriginRequest } from "@/lib/request-origin";

type Context = { params: Promise<{ id: string }> };
function refresh() { for (const path of ["/", "/categories", "/products", "/admin/categories", "/admin/products"]) revalidatePath(path); }

export async function PATCH(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = categorySchema.partial().safeParse(await request.json().catch(() => null));
  if (!parsed.success || !Object.keys(parsed.data).length) return NextResponse.json({ message: "Invalid category details." }, { status: 400 });
  const { id } = await context.params;
  try {
    const category = await saveMenuCategory(parsed.data, id);
    refresh();
    return NextResponse.json({ data: category });
  } catch (error) { return NextResponse.json({ message: error instanceof CategoryError ? error.message : "Category could not be changed. Check that its name and slug are unique." }, { status: error instanceof CategoryError ? error.status : 409 }); }
}

export async function DELETE(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const denied = await authorizeManagement();
  if (denied) return denied;
  const { id } = await context.params;
  try {
    await deleteMenuCategory(id);
    refresh();
    return NextResponse.json({ success: true });
  } catch (error) { return NextResponse.json({ message: error instanceof CategoryError ? error.message : "Category could not be deleted. Refresh and try again." }, { status: error instanceof CategoryError ? error.status : 409 }); }
}
