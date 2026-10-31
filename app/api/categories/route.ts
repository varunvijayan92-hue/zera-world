import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { authorizeManagement } from "@/lib/api-auth";
import { categorySchema } from "@/lib/category";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const denied = await authorizeManagement();
  if (denied) return denied;
  return NextResponse.json({ data: await prisma.storeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }) });
}

export async function POST(request: Request) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = categorySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message }, { status: 400 });
  try {
    const category = await prisma.storeCategory.create({ data: parsed.data });
    for (const path of ["/", "/products", "/admin/categories", "/admin/products"]) revalidatePath(path);
    return NextResponse.json({ data: category }, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Category could not be saved. Choose a unique name and slug." }, { status: 409 });
  }
}
