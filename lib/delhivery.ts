import { integrationCredentials } from "./integration-settings";
import { AccessError } from "./portal-access";

export async function trackDelhivery(awb: string) {
  if (!/^[a-zA-Z0-9-]{5,40}$/.test(awb)) throw new AccessError("Invalid AWB.");
  const credentials = await integrationCredentials("DELHIVERY");
  const token = credentials.apiToken || process.env.DELHIVERY_API_TOKEN;
  if (!token) throw new AccessError("Add your Delhivery API token in admin settings.", 503);
  const url = new URL("https://track.delhivery.com/api/v1/packages/json/"); url.searchParams.set("waybill", awb);
  const response = await fetch(url, { headers: { Authorization: `Token ${token}` }, cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw new AccessError(response.status === 401 ? "Delhivery rejected the API credentials." : "Delhivery tracking is temporarily unavailable.", 502);
  const data = await response.json();
  const shipment = data?.ShipmentData?.[0]?.Shipment;
  if (!shipment) throw new AccessError("No tracking record was found for this AWB.", 404);
  const status = String(shipment.Status?.Status || "Unknown").slice(0, 100);
  const scans: { type: string; description: string; date: Date }[] = [];
  for (const item of (Array.isArray(shipment.Scans) ? shipment.Scans : []).slice(-50)) {
    const scan = item.ScanDetail; const date = new Date(scan?.ScanDateTime);
    if (!scan || !Number.isFinite(date.getTime())) continue;
    scans.push({ type: String(scan.Scan || "Update").slice(0, 100), description: [scan.ScannedLocation, scan.Instructions].filter(Boolean).join(" · ").slice(0, 500), date });
  }
  return { status, scans };
}
