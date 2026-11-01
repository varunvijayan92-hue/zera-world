import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeManagement } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const denied = await authorizeManagement();
  if (denied) return denied;
  const parsed = z.object({ ids: z.array(z.string().min(1)).max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || new Set(parsed.data.ids).size !== parsed.data.ids.length) return NextResponse.json({ message: "Invalid menu order." }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.storeCategory.findMany({ select: { id: true } });
      if (existing.length !== parsed.data.ids.length || existing.some((entry) => !parsed.data.ids.includes(entry.id))) throw Error("Menu changed");
      for (const [sortOrder, id] of parsed.data.ids.entries()) await tx.storeCategory.update({ where: { id }, data: { sortOrder } });
    }, { isolationLevel: "Serializable" });
    for (const path of ["/", "/products", "/admin/categories"]) revalidatePath(path);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ message: "The menu changed. Refresh before reordering it." }, { status: 409 }); }
}
