import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, supplierAccess, AccessError, apiError } from "@/lib/portal-access";
import { cloudinaryMedia, PhotoError } from "@/lib/cloudinary";
import { validatePhoto, MAX_PRODUCT_PHOTOS, MAX_PHOTO_BYTES } from "@/lib/product-photos";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let uploaded: { url: string; publicId: string } | undefined;
  let linked = false;

  try {
    // 1. Authenticate user as ADMIN/MANAGER or active SUPPLIER
    let role: "ADMIN" | "SUPPLIER" = "ADMIN";
    let supplierId: string | null = null;

    try {
      await portalUser("ADMIN", request);
      role = "ADMIN";
    } catch {
      const supplierAcc = await supplierAccess(request);
      role = "SUPPLIER";
      supplierId = supplierAcc.supplier.id;
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      throw new AccessError("Content-Type must be multipart/form-data.", 400);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const kind = (formData.get("kind") as string) || "products";
    const productId = formData.get("productId") as string | null;
    const categoryId = formData.get("categoryId") as string | null;

    if (!(file instanceof File)) {
      throw new AccessError("No image file provided. Please attach a file.", 400);
    }

    if (file.size > MAX_PHOTO_BYTES) {
      throw new AccessError(`Photo exceeds maximum size of 5 MB.`, 400);
    }

    // 2. Validate file bytes and format
    const buffer = await validatePhoto(file);

    // 3. If productId provided, verify product ownership and photo capacity
    if (productId) {
      const product = await prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, supplierId: true, imageUrls: true },
      });

      if (!product) {
        throw new AccessError("Product not found.", 404);
      }

      if (role === "SUPPLIER" && product.supplierId !== supplierId) {
        throw new AccessError("You do not have permission to modify this product.", 403);
      }

      if (product.imageUrls.length >= MAX_PRODUCT_PHOTOS) {
        throw new AccessError(`Product already has the maximum of ${MAX_PRODUCT_PHOTOS} photos.`, 409);
      }
    }

    // 4. If categoryId provided, verify category exists (Admin only)
    if (categoryId) {
      if (role !== "ADMIN") {
        throw new AccessError("Only administrators can upload category images.", 403);
      }
      const category = await prisma.storeCategory.findUnique({
        where: { id: categoryId },
        select: { id: true },
      });
      if (!category) {
        throw new AccessError("Category not found.", 404);
      }
    }

    // 5. Upload to Cloudinary Cloud Storage
    const folderTargetId = productId || categoryId || "general";
    uploaded = await cloudinaryMedia.upload(buffer, folderTargetId, kind === "categories" ? "categories" : "products");

    // 6. Link to PostgreSQL Database via Prisma
    let updatedImageUrls: string[] = [];

    if (productId) {
      const updated = await prisma.$transaction(async (tx) => {
        const prod = await tx.product.findUnique({
          where: { id: productId },
          select: { imageUrls: true },
        });
        const currentUrls = prod?.imageUrls || [];
        const nextUrls = [...currentUrls, uploaded!.url];
        return tx.product.update({
          where: { id: productId },
          data: { imageUrls: nextUrls },
          select: { id: true, imageUrls: true },
        });
      });
      linked = true;
      updatedImageUrls = updated.imageUrls;
      try {
        revalidatePath(`/products/${productId}`);
        revalidatePath("/products");
        revalidatePath("/admin/products");
      } catch {}
    } else if (categoryId) {
      await prisma.storeCategory.update({
        where: { id: categoryId },
        data: { imageUrl: uploaded.url, imagePublicId: uploaded.publicId },
      });
      linked = true;
      try {
        revalidatePath("/categories");
        revalidatePath("/admin/categories");
      } catch {}
    }

    return NextResponse.json({
      success: true,
      url: uploaded.url,
      publicId: uploaded.publicId,
      productId: productId || undefined,
      categoryId: categoryId || undefined,
      imageUrls: updatedImageUrls.length ? updatedImageUrls : undefined,
      message: "Photo uploaded to cloud storage and linked to database successfully.",
    });
  } catch (error) {
    if (uploaded && !linked) {
      await cloudinaryMedia.removeOwnUpload(uploaded.publicId).catch(() => {});
    }
    if (error instanceof PhotoError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return apiError(error);
  }
}
