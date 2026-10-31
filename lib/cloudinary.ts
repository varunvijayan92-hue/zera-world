import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

export class PhotoError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function cloudinarySettings() {
  try {
    const url = new URL(process.env.CLOUDINARY_URL || "");
    if (url.protocol !== "cloudinary:" || !url.username || !url.password || !url.hostname || /\*{2,}/.test(decodeURIComponent(url.password))) throw Error();
    return { cloud_name: url.hostname, api_key: decodeURIComponent(url.username), api_secret: decodeURIComponent(url.password), secure: true };
  } catch { throw new PhotoError("Cloudinary is not configured. Check the server environment.", 503); }
}

export type UploadedPhoto = { publicId: string; url: string };
export const cloudinaryMedia = {
  async upload(buffer: Buffer, productId: string): Promise<UploadedPhoto> {
    cloudinary.config(cloudinarySettings());
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          resource_type: "image", folder: `zeraworld/products/${productId}`,
          allowed_formats: ["jpg", "png", "webp"], overwrite: false,
          unique_filename: true, use_filename: false, timeout: 30000,
        }, (error, response) => {
          if (error || !response) reject(error || new Error("Empty upload response"));
          else resolve(response);
        });
        stream.end(buffer);
      });
      return { publicId: result.public_id, url: result.secure_url };
    } catch {
      throw new PhotoError("Cloudinary upload failed. Check the account credentials and try again.", 502);
    }
  },
  async removeOwnUpload(publicId: string) {
    cloudinary.config(cloudinarySettings());
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  },
};
