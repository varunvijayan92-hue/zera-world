import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeManagement } from "@/lib/api-auth";
import { PhotoError } from "@/lib/cloudinary";
import { MAX_PHOTO_BYTES, MAX_PRODUCT_PHOTOS, productPhotoStore, uploadProductPhotos, changePhotoOrder } from "@/lib/product-photos";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function refresh(id: string) {
  for (const path of ["/", "/products", `/products/${id}`, "/admin/products"]) revalidatePath(path);
}
function failure(error: unknown) {
  if (error instanceof PhotoError) return NextResponse.json({ message: error.message }, { status: error.status });
  return NextResponse.json({ message: "Photos could not be saved. Please refresh the product and try again." }, { status: 500 });
}

export async function POST(request: Request, context: Context) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ message: "Invalid request origin." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length")) > MAX_PHOTO_BYTES * MAX_PRODUCT_PHOTOS + 100000) throw new PhotoError("Upload is too large.", 413);
    const { id } = await context.params;
    const form = await request.formData();
    const values = form.getAll("files");
    if (values.some((value) => !(value instanceof File))) throw new PhotoError("Choose image files to upload.");
    const product = await uploadProductPhotos(id, values as File[]);
    refresh(id);
    return NextResponse.json({ data: product }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: Context) {
  const denied = await authorizeManagement();
  if (denied) return denied;
  try {
    const parsed = z.object({ url: z.string().url(), action: z.enum(["cover", "remove"]) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new PhotoError("Invalid photo change.");
    const { id } = await context.params;
    const product = await productPhotoStore.change(id, (urls) => changePhotoOrder(urls, parsed.data.url, parsed.data.action));
    refresh(id);
    return NextResponse.json({ data: product });
  } catch (error) { return failure(error); }
}
