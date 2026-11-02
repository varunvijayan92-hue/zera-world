export function showStruckMrp(sellingPrice: unknown, mrp: unknown) {
  return Number.isFinite(Number(mrp)) && Number(mrp) > Number(sellingPrice) && Number(sellingPrice) > 0;
}
