export function returnEligibility(item: { isReturnable: boolean | null; returnDays: number | null }, deliveredAt: Date | null, now = new Date()) {
  if (!deliveredAt) return "Returns are available after delivery is confirmed.";
  if (item.isReturnable !== true) return "This item is not returnable.";
  if (item.returnDays === null || item.returnDays < 1) return "The return window is unavailable.";
  if (now.getTime() > deliveredAt.getTime() + item.returnDays * 86400000) return "The return window has closed.";
  return null;
}
