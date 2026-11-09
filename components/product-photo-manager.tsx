"use client";

import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { ProductImage } from "./product-image";

export function ProductPhotoManager({ productId, images, colors, initialColorImages, onChanged }: { productId: string; images: string[]; colors: string[]; initialColorImages: Record<string, string>; onChanged: (urls: string[]) => void }) {
  const [colorImages, setColorImages] = useState(initialColorImages);
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function upload() {
    if (!files.length) return;
    setBusy(true); setMessage("");
    try {
      if (files.length + images.length > 6) throw Error("A product can have up to 6 photos. Remove a photo before adding more.");
      if (files.some((file) => file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) throw Error("Choose JPEG, PNG or WebP photos up to 5 MB each.");
      const data = new FormData(); files.forEach((file) => data.append("files", file));
      const response = await fetch(`/api/products/${productId}/images`, { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Upload failed.");
      onChanged(result.data.imageUrls); setFiles([]); if (input.current) input.current.value = "";
      setMessage("Photos saved to Cloudinary and linked to this product.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function saveColors() {
    setBusy(true); setMessage("");
    try {
      const assignments = Object.fromEntries(Object.entries(colorImages).filter(([color, url]) => colors.includes(color) && images.includes(url)));
      const response = await fetch(`/api/products/${productId}/colour-images`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images: assignments }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Could not save colour photos.");
      setColorImages(assignments); setMessage(result.message);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save colour photos."); }
    finally { setBusy(false); }
  }
  async function change(url: string, action: "cover" | "remove") {
    setBusy(true); setMessage("");
    try {
      const response = await fetch(`/api/products/${productId}/images`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, action }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Photo could not be changed.");
      onChanged(result.data.imageUrls); setMessage(action === "cover" ? "Main photo updated for this product." : "Photo removed from this product. The original stays in your Cloudinary library.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Photo could not be changed."); }
    finally { setBusy(false); }
  }
  return <section className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Product photos</h2><span className="text-sm text-[#173B35]/60">{images.length}/6</span></div><p className="mt-2 text-sm text-[#173B35]/65">The first photo is shown on product cards. Photos are stored in Cloudinary.</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{images.map((url, index) => <div key={url} className="overflow-hidden rounded-2xl border border-[#173B35]/10"><ProductImage src={url} alt={`Product photo ${index + 1}`} width={400} height={400} sizes="250px" className="h-44 w-full object-cover" /><div className="space-y-2 p-3"><p className="text-xs font-bold">Photo {index + 1}</p>{index === 0 ? <p className="text-xs font-bold">Main photo</p> : <button type="button" disabled={busy} onClick={() => change(url, "cover")} className="block text-xs font-semibold underline">Use as main photo</button>}<button type="button" disabled={busy} onClick={() => change(url, "remove")} className="block text-xs text-red-700 underline">Remove from product</button></div></div>)}</div>{colors.length ? <div className="mt-5 space-y-3 rounded-2xl border p-4"><h3 className="font-bold">Photos for each colour</h3><p className="text-sm">Upload your photos first, then choose a photo for each saved colour.</p>{colors.map(color => <label key={color} className="block text-sm font-semibold">{color}<select aria-label={`Photo for ${color}`} value={images.includes(colorImages[color]) ? colorImages[color] : ""} onChange={event => setColorImages(current => ({ ...current, [color]: event.target.value }))} className="mt-2 block w-full rounded-xl border p-3"><option value="">No specific photo</option>{images.map((url, index) => <option key={url} value={url}>Photo {index + 1}{index === 0 ? " (main)" : ""}</option>)}</select></label>)}<button type="button" disabled={busy} onClick={saveColors} className="rounded-xl border px-4 py-2 font-semibold disabled:opacity-40">Save colour photos</button></div> : null}<div className="mt-5 rounded-2xl border border-dashed border-[#173B35]/25 bg-[#F7F4ED] p-5"><label className="block text-sm font-semibold">Choose product photos<input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy || images.length >= 6} onChange={(event) => { setFiles(Array.from(event.target.files || [])); setMessage(""); }} className="mt-3 block w-full text-sm" /></label><p className="mt-2 text-xs text-[#173B35]/60">JPEG, PNG or WebP, up to 5 MB per photo. Up to 6 photos per product.</p><button type="button" disabled={busy || !files.length} onClick={upload} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"><Upload size={16} />{busy ? "Saving..." : "Upload to Cloudinary"}</button></div>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}</section>;
}
