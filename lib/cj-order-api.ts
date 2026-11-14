const BASE = "https://developers.cjdropshipping.com/api2.0/v1";

type Fetcher = typeof fetch;
type CjResult = { code?: number; result?: boolean; data?: unknown; requestId?: string };

/** Server-side CJ client. Errors never include credentials or customer addresses. */
export async function cjOrderRequest(token: string, path: "shopping/order/createOrderV2" | "shopping/order/getOrderDetail", options: { payload?: Record<string, unknown>; orderId?: string; fetcher?: Fetcher }) {
  if (!token || /[\r\n]/.test(token)) throw new Error("CJ access token is missing or invalid.");
  const url = new URL(`${BASE}/${path}`);
  if (path === "shopping/order/getOrderDetail") {
    if (!options.orderId || options.orderId.length > 200) throw new Error("CJ order reference is missing.");
    url.searchParams.set("orderId", options.orderId);
  }
  if (path === "shopping/order/createOrderV2" && (!options.payload || options.payload.payType !== 3)) throw new Error("Only unpaid CJ orders can be created.");
  let response: Response;
  try {
    response = await (options.fetcher || fetch)(url, { method: options.payload ? "POST" : "GET", headers: { "CJ-Access-Token": token, ...(options.payload ? { "Content-Type": "application/json" } : {}) }, ...(options.payload ? { body: JSON.stringify(options.payload) } : {}), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch { throw new Error("CJ request outcome is unknown; check CJ before retrying."); }
  const body = await response.json().catch(() => null) as CjResult | null;
  if (!response.ok || body?.code !== 200 || body.result !== true) throw new Error("CJ request failed; check CJ before retrying.");
  return body.data;
}
