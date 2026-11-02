export function ProductPrice({ sellingPrice, mrp, className = "", priceClassName = "font-bold" }: { sellingPrice: number; mrp?: number | null; className?: string; priceClassName?: string }) {
  const money = (value: number) => `\u20B9${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  return <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${className}`}><span className={priceClassName}>{money(sellingPrice)}</span></div>;
}
