import { NextResponse } from "next/server";
import { portalUser, apiError } from "@/lib/portal-access";

export async function GET(request: Request) {
  try { await portalUser("ADMIN", request); }
  catch (error) { return apiError(error); }
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { signal: AbortSignal.timeout(8000), next: { revalidate: 3600 } });
    if (!response.ok) throw new Error();
    const result = await response.json();
    const rate = Number(result?.rates?.INR);
    if (result?.result !== "success" || !Number.isFinite(rate) || rate <= 0 || rate > 10000) throw new Error();
    return NextResponse.json({ data: { base: "USD", quote: "INR", rate, updatedAt: result.time_last_update_utc, attribution: "https://www.exchangerate-api.com" } });
  } catch {
    return NextResponse.json({ message: "Exchange rate unavailable. Enter a USD to INR rate manually." }, { status: 503 });
  }
}
