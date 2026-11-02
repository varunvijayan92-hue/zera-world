import { integrationCredentials } from "./integration-settings";
import { AccessError } from "./portal-access";

const API_URL = "https://apiv2.shiprocket.in/v1/external";

async function call(path: string, options: RequestInit) {
  try {
    const response = await fetch(`${API_URL}${path}`, { ...options, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new AccessError(
      [401, 403].includes(response.status) ? "Shiprocket rejected the credentials or API permissions. Check Settings." : response.status === 404 ? "Shiprocket could not find this record." : "Shiprocket is temporarily unavailable. Try again later.",
      response.status === 404 ? 404 : 502,
    );
    return await response.json();
  } catch (error) {
    if (error instanceof AccessError) throw error;
    throw new AccessError("Shiprocket could not be reached. Try again later.", 502);
  }
}

async function token() {
  const credentials = await integrationCredentials("SHIPROCKET");
  if (!credentials.email || !credentials.password) throw new AccessError("Add your Shiprocket API user email and password in admin Settings.", 503);
  // Authenticate on the server; tokens and credentials are never returned to the browser.
  const result = await call("/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: credentials.email, password: credentials.password }) });
  if (typeof result?.token !== "string" || !result.token || /[\r\n]/.test(result.token)) throw new AccessError("Shiprocket did not return a valid authentication token.", 502);
  return result.token;
}

export async function shiprocketPickupLocations() {
  const data = await call("/settings/company/pickup?isActive=1", { headers: { Authorization: `Bearer ${await token()}` } });
  const addresses = data?.data?.shipping_address === null ? [] : data?.data?.shipping_address;
  if (!Array.isArray(addresses)) throw new AccessError("Shiprocket returned an invalid pickup address response.", 502);
  return addresses.slice(0, 500).map((entry) => ({ name: String(entry.pickup_location || "Unnamed pickup location").slice(0, 200) }));
}

export async function trackShiprocket(awb: string) {
  if (!/^[a-zA-Z0-9-]{5,40}$/.test(awb)) throw new AccessError("Invalid AWB.");
  const data = await call(`/courier/track/awb/${encodeURIComponent(awb)}`, { headers: { Authorization: `Bearer ${await token()}` } });
  const tracking = data?.tracking_data;
  if (!tracking || !Array.isArray(tracking.shipment_track) || !tracking.shipment_track.length) throw new AccessError("No Shiprocket tracking record was found for this AWB.", 404);
  const scans: { type: string; description: string; date: Date }[] = [];
  for (const scan of (Array.isArray(tracking.shipment_track_activities) ? tracking.shipment_track_activities : []).slice(0, 50)) {
    // Shiprocket's date strings are Indian local time when an offset is absent.
    const value = String(scan?.date || "");
    const date = new Date(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(" ", "T")}+05:30` : value);
    if (!Number.isFinite(date.getTime())) continue;
    scans.push({ type: String(scan.status || "Update").slice(0, 100), description: [scan.location, scan.activity].filter(Boolean).join(" · ").slice(0, 500), date });
  }
  return { status: String(tracking.shipment_track[0].current_status || "Unknown").slice(0, 100), scans };
}
