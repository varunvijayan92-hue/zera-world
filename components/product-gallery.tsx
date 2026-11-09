"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductImage } from "./product-image";
import { useClientReady } from "./use-client-ready";

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [selected, setSelected] = useState(0);
  const ready = useClientReady();
  const thumbs = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = thumbs.current;
    const active = row?.children[selected] as HTMLElement | undefined;
    if (row && active) row.scrollTo({ left: active.offsetLeft - row.offsetLeft, behavior: "auto" });
  }, [selected]);
  return <div className="space-y-4">
    <div className="relative overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-[#F7F4ED]">
      <ProductImage src={images[selected] || images[0]} alt={name} fit="contain" width={900} height={900} sizes="(min-width: 1024px) 50vw, 100vw" priority className="h-64 w-full object-contain p-3 sm:h-[420px] sm:p-4" />
      {images.length > 1 ? <><button type="button" onClick={() => setSelected(value => Math.max(0, value - 1))} disabled={!ready || selected === 0} aria-label="Previous product photo" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow disabled:opacity-30"><ChevronLeft size={20} /></button><button type="button" onClick={() => setSelected(value => Math.min(images.length - 1, value + 1))} disabled={!ready || selected >= images.length - 1} aria-label="Next product photo" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/95 p-2 shadow disabled:opacity-30"><ChevronRight size={20} /></button></> : null}
    </div>
    {images.length > 1 ? <div ref={thumbs} aria-label="Product photo thumbnails" tabIndex={0} className="flex snap-x gap-3 overflow-x-auto pb-2">{images.map((image, index) => <button key={image} type="button" disabled={!ready} onClick={() => setSelected(index)} aria-label={`View photo ${index + 1} of ${name}`} aria-pressed={selected === index} className={`w-20 shrink-0 snap-start overflow-hidden rounded-xl border-2 sm:w-24 ${selected === index ? "border-[#173B35]" : "border-transparent"}`}>
      <ProductImage src={image} alt={`${name} photo ${index + 1}`} fit="contain" width={160} height={160} sizes="100px" className="h-24 w-full bg-[#F7F4ED] object-contain p-1" />
    </button>)}</div> : null}
  </div>;
}
