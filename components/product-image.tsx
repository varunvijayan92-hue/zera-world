"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { CldImage } from "next-cloudinary";
import { useState } from "react";
import { isCloudinaryPhoto } from "@/lib/image-source";

export function ProductImage({ src, alt, width, height, sizes, className = "", priority = false, fit = "cover" }: {
  src?: string | null; alt: string; width: number; height: number; sizes?: string; className?: string; priority?: boolean; fit?: "cover" | "contain";
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) return <div role="img" aria-label={`Photo unavailable: ${alt}`} className={`flex items-center justify-center bg-[#F7F4ED] text-[#173B35]/40 ${className}`} style={{ aspectRatio: `${width}/${height}` }}><ImageIcon size={36} /></div>;
  const shared = { src, width, height, sizes, className, priority, onError: () => setFailedSrc(src) };
  return isCloudinaryPhoto(src, process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)
    ? <CldImage {...shared} alt={alt} crop={fit === "contain" ? "limit" : { type: "auto", source: true }} />
    : <Image {...shared} alt={alt} unoptimized />;
}
