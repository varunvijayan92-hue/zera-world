import { integrationCredentials } from "./integration-settings";
import { AccessError } from "./portal-access";

const base = "https://developers.cjdropshipping.com/api2.0/v1";
type CjResponse = { code?: number; result?: boolean; data?: unknown };
async function cjRequest(url: string, init: RequestInit): Promise<CjResponse> {
  let response: Response;
  try { response = await fetch(url, { ...init, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) }); }
  catch { throw new AccessError("CJ could not be reached. Try again later.", 502); }
  if (!response.ok) throw new AccessError("CJ could not complete the request. Try again later.", 502);
  const body = await response.json().catch(() => null) as CjResponse | null;
  if (!body || body.code !== 200 || body.result !== true) throw new AccessError("CJ could not complete the request. Check your API access and try again.", 502);
  return body;
}
async function cjToken() {
  const { apiKey } = await integrationCredentials("CJ_DROPSHIPPING");
  if (!apiKey) throw new AccessError("Add the CJ API key under Suppliers → CJ API settings first.", 400);
  const auth = await cjRequest(`${base}/authentication/getAccessToken`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }) });
  const data = auth.data as { accessToken?: unknown } | null;
  if (typeof data?.accessToken !== "string" || !data.accessToken || /[\r\n]/.test(data.accessToken)) throw new AccessError("CJ did not return a valid access token.", 502);
  return data.accessToken;
}
export async function cjCatalogRequest(path: "listV2" | "query", params: URLSearchParams) {
  const token = await cjToken();
  return cjRequest(`${base}/product/${path}?${params.toString()}`, { headers: { "CJ-Access-Token": token } });
}
export async function cjFreightQuote(input: { origin: string; pincode: string; variantId: string }) {
  const token = await cjToken();
  const result = await cjRequest(`${base}/logistic/freightCalculate`, { method: "POST", headers: { "Content-Type": "application/json", "CJ-Access-Token": token }, body: JSON.stringify({ startCountryCode: input.origin, endCountryCode: "IN", zip: input.pincode, products: [{ quantity: 1, vid: input.variantId }] }) });
  if (!Array.isArray(result.data)) throw new AccessError("CJ returned an invalid shipping quote.", 502);
  return result.data.flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.logisticName !== "string" || typeof item.logisticPrice !== "number" || !Number.isFinite(item.logisticPrice) || item.logisticPrice < 0) return [];
    return [{ name: item.logisticName.slice(0, 100), usd: item.logisticPrice, estimate: typeof item.logisticAging === "string" ? item.logisticAging.slice(0, 80) : "Not provided" }];
  }).slice(0, 50);
}

export function cjCatalogProducts(data: unknown) {
  const groups = data && typeof data === "object" && "content" in data && Array.isArray(data.content) ? data.content : [];
  return groups.flatMap(group => group && typeof group === "object" && "productList" in group && Array.isArray(group.productList) ? group.productList : []).flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.id !== "string" || typeof item.nameEn !== "string") return [];
    return [{ id: item.id.slice(0, 100), name: item.nameEn.slice(0, 250), sku: typeof item.sku === "string" ? item.sku.slice(0, 100) : "", price: typeof item.sellPrice === "string" || typeof item.sellPrice === "number" ? String(item.sellPrice).slice(0, 50) : "" }];
  }).slice(0, 20);
}
export function cjCatalogVariants(data: unknown) {
  const value = data && typeof data === "object" ? data as { pid?: unknown; variants?: unknown } : {};
  const variants = Array.isArray(value.variants) ? value.variants : [];
  return variants.flatMap(item => {
    if (!item || typeof item !== "object" || typeof item.vid !== "string") return [];
    return [{ id: item.vid.slice(0, 100), name: typeof item.variantNameEn === "string" ? item.variantNameEn.slice(0, 250) : "Variant", sku: typeof item.variantSku === "string" ? item.variantSku.slice(0, 100) : "" }];
  }).slice(0, 100);
}

export type CjSyncState = "CONNECTED" | "PENDING" | "NOT_AVAILABLE";

export function cjProductSyncStatus() {
  return {
    status: "PENDING" as const,
    available: false,
    message: "CJ product synchronization is not enabled yet. Save a supplier mapping and review the product before the live sync is connected.",
    source: "CJ_DROPSHIPPING",
    lastSync: null,
  };
}

export function cjOrderSyncStatus() {
  return {
    status: "PENDING" as const,
    available: false,
    message: "CJ order automation is not connected yet. Use the supplier review workflow until a live CJ order connector is implemented.",
    source: "CJ_DROPSHIPPING",
    lastSync: null,
  };
}

export function cjIntegrationStatus() {
  const message = "CJ authentication succeeded. Product and order integration is not yet implemented.";
  return {
    status: "CONNECTED" as const,
    available: true,
    message,
    productIntegration: cjProductSyncStatus(),
    orderIntegration: cjOrderSyncStatus(),
    capabilities: ["authentication", "catalog-search", "shipping-quote"],
  };
}
