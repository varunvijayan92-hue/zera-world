import { NextResponse } from "next/server";
import { integrationCredentials } from "@/lib/integration-settings";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { cjIntegrationStatus } from "@/lib/cj-catalog";

export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    if (user.role !== "ADMIN") throw new AccessError("Only administrators can check CJ credentials.", 403);
    const { apiKey } = await integrationCredentials("CJ_DROPSHIPPING");
    if (!apiKey) throw new AccessError("Save a CJ API key first.");
    let response: Response;
    try { response = await fetch("https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) }); }
    catch { throw new AccessError("CJ could not be reached. Try again later.", 502); }
    if (!response.ok) throw new AccessError("CJ could not authenticate the connection. Check the API key and account access.", 502);
    const result = await response.json().catch(() => null);
    if (result?.code !== 200 || result?.result !== true || typeof result?.data?.accessToken !== "string" || !result.data.accessToken) throw new AccessError("CJ did not accept the API key. Check the key and account access.", 400);
    const status = cjIntegrationStatus();
    return NextResponse.json({ ...status, message: status.message }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
