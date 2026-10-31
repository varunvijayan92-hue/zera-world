export function isCloudinaryPhoto(src: string | null | undefined, cloudName?: string) {
  if (!src || !cloudName) return false;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com"
      && url.pathname.startsWith(`/${cloudName}/image/upload/`) && /\/v\d+\//.test(url.pathname);
  } catch { return false; }
}
