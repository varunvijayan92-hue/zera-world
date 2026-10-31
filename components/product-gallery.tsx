"use client";

import { useState } from "react";
import { ProductImage } from "./product-image";
import { useClientReady } from "./use-client-ready";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const ready = useClientReady();
  return <div className="space-y-4">
    <div className="overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-[#F7F4ED]">
      <ProductImage src={images[selected] || images[0]} alt={name} width={900} height={900} sizes="(min-width: 1024px) 50vw, 100vw" priority className="h-[420px] w-full object-contain" />
    </div>
    {images.length > 1 ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">{images.map((image, index) => <button key={image} type="button" disabled={!ready} onClick={() => setSelected(index)} aria-label={`View photo ${index + 1} of ${name}`} aria-pressed={selected === index} className={`overflow-hidden rounded-xl border-2 ${selected === index ? "border-[#173B35]" : "border-transparent"}`}>
      <ProductImage src={image} alt={`${name} photo ${index + 1}`} width={160} height={160} sizes="100px" className="h-24 w-full object-cover" />
    </button>)}</div> : null}
  </div>;
}
