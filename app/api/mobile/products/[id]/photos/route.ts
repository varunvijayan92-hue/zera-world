import { NextResponse } from "next/server";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { uploadProductPhotos } from "@/lib/product-photos";
import { PhotoError } from "@/lib/cloudinary";
import { revalidatePath } from "next/cache";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { id } = await params;
    const form = await request.formData();
    const entries = form.getAll("files");
    if (entries.some(file => !(file instanceof File))) throw new AccessError("Attach photos using the files field.");
    const data = await uploadProductPhotos(id, entries as File[]);
    for (const path of ["/", "/products", `/products/${id}`, "/admin/products"]) revalidatePath(path);
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof PhotoError) return NextResponse.json({ message: error.message }, { status: error.status });
    return apiError(error);
  }
}
