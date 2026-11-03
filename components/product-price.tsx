import { showStruckMrp } from "@/lib/product-pricing-display";
import { singleItemTotal } from "@/lib/customer-price";

export function ProductPrice({ sellingPrice, gstRate, handlingCharge, mrp, className = "", priceClassName = "font-bold" }: { sellingPrice: number; gstRate?: number | string | null; handlingCharge?: number | string | null; mrp?: number | null; className?: string; priceClassName?: string }) {
  const total = singleItemTotal({ sellingPrice, gstRate, handlingCharge });
  const money = (value: number) => `\u20B9${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  const showMrp = showStruckMrp(total, mrp);

  return <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}>
    {showMrp ? <span className="text-base text-[#173B35]/45 line-through decoration-2 decoration-[#173B35]/70">{money(Number(mrp))}</span> : null}
    <span className={priceClassName}>{money(total)}</span>
    <span className="basis-full text-xs font-normal text-[#173B35]/60">Total for 1 item, including taxes and charges</span>
  </div>;
}
