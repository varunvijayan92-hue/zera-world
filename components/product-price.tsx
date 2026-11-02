import { showStruckMrp } from "@/lib/product-pricing-display";

export function ProductPrice({ sellingPrice, mrp, className = "", priceClassName = "font-bold" }: { sellingPrice: number; mrp?: number | null; className?: string; priceClassName?: string }) {
  const money = (value: number) => `\u20B9${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const showMrp = showStruckMrp(sellingPrice, mrp);

  return <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
    {showMrp ? <span className="text-base text-[#173B35]/45 line-through decoration-2 decoration-[#173B35]/70">{money(Number(mrp))}</span> : null}
    <span className={priceClassName}>{money(sellingPrice)}</span>
  </div>;
}
