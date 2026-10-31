import { prisma } from "./prisma";
import { cloudinaryMedia, PhotoError, type UploadedPhoto } from "./cloudinary";

export const MAX_PRODUCT_PHOTOS = 6;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function validatePhoto(file: File) {
  if (!file.size || file.size > MAX_PHOTO_BYTES) throw new PhotoError("Each photo must be between 1 byte and 5 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new PhotoError("Use JPEG, PNG or WebP photos.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!(file.type === "image/jpeg" && jpeg || file.type === "image/png" && png || file.type === "image/webp" && webp)) {
    throw new PhotoError("A selected file is not a valid JPEG, PNG or WebP photo.");
  }
  return buffer;
}

export const productPhotoStore = {
  find(productId: string) { return prisma.product.findUnique({ where: { id: productId }, select: { id: true, imageUrls: true } }); },
  async change(productId: string, change: (urls: string[]) => string[]) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: productId }, select: { imageUrls: true } });
      if (!product) throw new PhotoError("Product not found.", 404);
      const urls = change(product.imageUrls);
      if (urls.length > MAX_PRODUCT_PHOTOS) throw new PhotoError(`A product can have up to ${MAX_PRODUCT_PHOTOS} photos.`, 409);
      return tx.product.update({ where: { id: productId }, data: { imageUrls: urls }, select: { id: true, imageUrls: true } });
    }, { isolationLevel: "Serializable" });
  },
};

export async function uploadProductPhotos(productId: string, files: File[]) {
  if (!files.length || files.length > MAX_PRODUCT_PHOTOS) throw new PhotoError(`Choose between 1 and ${MAX_PRODUCT_PHOTOS} photos.`);
  const product = await productPhotoStore.find(productId);
  if (!product) throw new PhotoError("Product not found.", 404);
  if (product.imageUrls.length + files.length > MAX_PRODUCT_PHOTOS) throw new PhotoError(`A product can have up to ${MAX_PRODUCT_PHOTOS} photos.`, 409);
  const buffers = await Promise.all(files.map(validatePhoto));
  const uploaded: UploadedPhoto[] = [];
  try {
    // Keep uploads sequential so any partial batch can be cleaned up reliably.
    for (const buffer of buffers) uploaded.push(await cloudinaryMedia.upload(buffer, productId));
    return await productPhotoStore.change(productId, (urls) => [...urls, ...uploaded.map((photo) => photo.url)]);
  } catch (error) {
    await Promise.allSettled(uploaded.map((photo) => cloudinaryMedia.removeOwnUpload(photo.publicId)));
    throw error;
  }
}

export function changePhotoOrder(urls: string[], url: string, action: "cover" | "remove") {
  if (!urls.includes(url)) throw new PhotoError("That photo does not belong to this product.", 404);
  return action === "cover" ? [url, ...urls.filter((entry) => entry !== url)] : urls.filter((entry) => entry !== url);
}
