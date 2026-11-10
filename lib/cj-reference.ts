/** Accept a CJ product link or ID without making requests to the supplied URL. */
export function cjProductReference(input: string): { productId?: string; keyword?: string } | null {
  const value = input.trim();
  if (!value || value.length > 2048) return null;
  if (/^\d{10,30}$/.test(value)) return { productId: value };
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || !["cjdropshipping.com", "www.cjdropshipping.com"].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port) return null;
      const match = url.pathname.match(/\/product\/[^/]*-p-(\d{10,30})\.html\/?$/i);
      return match ? { productId: match[1] } : null;
    } catch { return null; }
  }
  if (value.length < 2 || value.length > 100) return null;
  return { keyword: value };
}

export function cjProductDetails(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const product = data as Record<string, unknown>;
  if (typeof product.pid !== "string" || typeof product.productNameEn !== "string") return null;
  return { id: product.pid.slice(0, 100), name: product.productNameEn.slice(0, 250), sku: typeof product.productSku === "string" ? product.productSku.slice(0, 100) : "", price: typeof product.sellPrice === "string" || typeof product.sellPrice === "number" ? String(product.sellPrice).slice(0, 50) : "" };
}
