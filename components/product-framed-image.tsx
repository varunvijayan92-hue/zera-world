import { ProductImage } from "./product-image";

/** Keep the actual product photo intact while filling unused space with a soft backdrop. */
export function ProductFramedImage({ src, alt, sizes, priority = false, padding = true }: { src?: string | null; alt: string; sizes: string; priority?: boolean; padding?: boolean }) {
  return <div className="relative h-full w-full overflow-hidden bg-[#F7F4ED]">
    {src ? <div aria-hidden="true" className="absolute inset-0 overflow-hidden"><ProductImage src={src} alt="" width={400} height={400} sizes={sizes} className="h-full w-full scale-110 object-cover opacity-30 blur-xl" /></div> : null}
    <ProductImage src={src} alt={alt} fit="contain" width={900} height={900} sizes={sizes} priority={priority} className={`relative h-full w-full object-contain ${padding ? "p-2" : ""}`} />
  </div>;
}
