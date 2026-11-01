import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { categorySchema } from "@/lib/category";
import { CategoryError, getMenuCategories, saveMenuCategory } from "@/lib/category-data";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function GET() {
  const denied = await authorizeManagement();
  if (denied) return denied;
  return NextResponse.json({ data: await getMenuCategories() });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const category = await saveMenuCategory(parsed.data);
    for (const path of ["/", "/categories", "/products", "/admin/categories", "/admin/products"]) revalidatePath(path);
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof CategoryError ? error.message : "Category could not be saved. Choose a unique name and slug." }, { status: error instanceof CategoryError ? error.status : 409 });
  }
}
