/** Parse the documented CJ order detail fields without assuming a shipment exists. */
export function parseCjShipment(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  const orderStatus = text(row.orderStatus)?.toUpperCase();
  if (orderStatus !== "SHIPPED" && orderStatus !== "DELIVERED") return null;
  const trackingNumber = text(row.trackNumber);
  if (!trackingNumber || trackingNumber.length > 200) return null;
  const courierName = text(row.trackingProvider) || text(row.logisticName);
  return { trackingNumber, courierName: courierName?.slice(0, 200) || null, status: orderStatus === "DELIVERED" ? "DELIVERED" as const : "IN_TRANSIT" as const };
}
