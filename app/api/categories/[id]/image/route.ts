import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { authorizeManagement } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { cloudinaryMedia, PhotoError } from "@/lib/cloudinary";
import { MAX_PHOTO_BYTES, validatePhoto } from "@/lib/product-photos";
import { isSameOriginRequest } from "@/lib/request-origin";
import { getMenuCategory } from "@/lib/category-data";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  let uploaded: { url: string; publicId: string } | undefined;
  let attached = false;
  try {
    if (Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES + 100000) throw new PhotoError("Image is too large.", 413);
    const { id } = await params;
    if (!await prisma.storeCategory.findUnique({ where: { id }, select: { id: true } })) throw new PhotoError("Category not found.", 404);
    const file = (await request.formData()).get("image");
    if (!(file instanceof File)) throw new PhotoError("Choose a JPEG, PNG or WebP image.");
    uploaded = await cloudinaryMedia.upload(await validatePhoto(file), id, "categories");
    await prisma.storeCategory.update({ where: { id }, data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId } });
    attached = true;
    const data = await getMenuCategory(id);
    for (const path of ["/", "/categories", "/products", "/admin/categories"]) revalidatePath(path);
    return NextResponse.json({ data });
  } catch (error) {
    if (uploaded && !attached) await cloudinaryMedia.removeOwnUpload(uploaded.publicId).catch(() => {});
    return NextResponse.json({ message: error instanceof PhotoError ? error.message : "Category image could not be saved." }, { status: error instanceof PhotoError ? error.status : 500 });
  }
}
export async function DELETE(request: Request, { params }: Context) {
  const denied = await authorizeManagement(); if (denied) return denied;
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const { id } = await params;
  if (!await getMenuCategory(id)) return NextResponse.json({ message: "Category not found." }, { status: 404 });
  await prisma.storeCategory.update({ where: { id }, data: { imageUrl: null, imagePublicId: null } });
  const data = await getMenuCategory(id);
  for (const path of ["/", "/categories", "/products", "/admin/categories"]) revalidatePath(path);
  return NextResponse.json({ data });
}
