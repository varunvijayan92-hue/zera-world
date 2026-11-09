import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeManagement } from "@/lib/api-auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { prisma } from "@/lib/prisma";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  const parsed = z.object({ images: z.record(z.string().max(100), z.string().url().max(2000)).refine(value => Object.keys(value).length <= 30) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid colour photo assignments." }, { status: 400 });
  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, select: { color: true, imageUrls: true } });
  if (!product) return NextResponse.json({ message: "Product not found." }, { status: 404 });
  const colors = new Set((product.color || "").split(",").map(value => value.trim()).filter(Boolean));
  if (Object.entries(parsed.data.images).some(([color, url]) => !colors.has(color) || !product.imageUrls.includes(url))) return NextResponse.json({ message: "Choose a saved product colour and an uploaded photo." }, { status: 400 });
  await prisma.product.update({ where: { id }, data: { colorImages: parsed.data.images } });
  revalidatePath(`/products/${id}`);
  revalidatePath("/admin/products");
  return NextResponse.json({ message: "Colour photos saved." });
}
