"use client";
import { useState } from "react";
import { ProductImage } from "./product-image";
import type { MenuCategory } from "@/lib/category";

export function CategoryImageField({ category, onSaved }: { category: MenuCategory; onSaved: (category: MenuCategory) => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function change(file?: File) {
    setBusy(true); setMessage("");
    try {
      const body = new FormData(); if (file) body.set("image", file);
      const response = await fetch(`/api/categories/${category.id}/image`, { method: file ? "POST" : "DELETE", ...(file ? { body } : {}) });
      const result = await response.json(); if (!response.ok) throw Error(result.message);
      onSaved(result.data); setMessage("Category image updated on the website.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); } finally { setBusy(false); }
  }
  return <div className="mt-3 space-y-2 text-sm">{category.imageUrl ? <ProductImage src={category.imageUrl} alt={category.name} fit="contain" width={240} height={144} className="aspect-[5/3] w-40 max-w-full rounded-xl bg-[#F7F4ED] object-contain p-1" /> : null}<label className="block font-semibold">Category image<input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void change(file); event.target.value = ""; }} className="mt-2 block max-w-full text-xs" /></label><p className="text-xs opacity-60">JPEG, PNG or WebP, up to 5 MB. Saved to Cloudinary.</p>{category.imageUrl ? <button type="button" disabled={busy} className="text-xs underline" onClick={() => change()}>Remove image</button> : null}{message ? <p role="status">{message}</p> : null}</div>;
}
