"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProductFramedImage } from "./product-framed-image";

export type CategoryBanner = { id: string; title: string; subtitle: string; image?: string | null; href: string };

export function CategoryCarousel({ categories }: { categories: CategoryBanner[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const update = () => setPosition({ previous: element.scrollLeft > 2, next: element.scrollLeft + element.clientWidth < element.scrollWidth - 2 });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    element.addEventListener("scroll", update, { passive: true });
    update();
    return () => { observer.disconnect(); element.removeEventListener("scroll", update); };
  }, [categories.length]);

  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    const distance = (element.firstElementChild?.getBoundingClientRect().width || element.clientWidth) + (parseFloat(getComputedStyle(element).columnGap) || 0);
    element.scrollBy({ left: direction * distance, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }

  if (!categories.length) return null;
  return <section id="categories" aria-label="Product categories" aria-roledescription="carousel" className="px-4 pt-5 md:px-6">
    <div className="mb-3 flex items-center justify-between gap-4"><h2 className="text-sm font-bold">Explore categories</h2><div className="flex gap-2"><button type="button" aria-label="Scroll categories left" aria-controls="category-carousel" disabled={!position.previous} onClick={() => move(-1)} className="rounded-full border border-[#173B35]/20 bg-white p-2 text-[#173B35] disabled:opacity-30"><ChevronLeft size={19} /></button><button type="button" aria-label="Scroll categories right" aria-controls="category-carousel" disabled={!position.next} onClick={() => move(1)} className="rounded-full border border-[#173B35]/20 bg-white p-2 text-[#173B35] disabled:opacity-30"><ChevronRight size={19} /></button></div></div>
    <div ref={track} id="category-carousel" tabIndex={0} aria-label="Category images. Use left and right arrow keys to scroll." className="category-carousel-track" onKeyDown={(event) => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); } }}>
      {categories.map((category) => <Link key={category.id} href={category.href} className="tokoo-banner-card category-carousel-card bg-[#173B35] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B38A45]">{category.image ? <div className="absolute inset-0"><ProductFramedImage src={category.image} alt={category.title} padding={false} sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 85vw" /></div> : null}<span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-black/10" /><div className="relative"><div className="tokoo-banner-badge">Collection</div><h3>{category.title}</h3><p className="line-clamp-2">{category.subtitle}</p></div></Link>)}
    </div>
  </section>;
}
