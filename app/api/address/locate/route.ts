import { NextResponse } from "next/server";
import { addressFromPhoton, coordinatesSchema } from "@/lib/geocoding";

export async function POST(request: Request) {
  const parsed = coordinatesSchema.safeParse(await request.json().catch(() => null));
  const headers = { "Cache-Control": "no-store" };
  if (!parsed.success) return NextResponse.json({ message: "Invalid location coordinates." }, { status: 400, headers });
  try {
    const url = new URL("reverse", `${(process.env.GEOCODING_BASE_URL || "https://photon.komoot.io").replace(/\/$/, "")}/`);
    url.searchParams.set("lat", String(parsed.data.latitude));
    url.searchParams.set("lon", String(parsed.data.longitude));
    url.searchParams.set("limit", "1");
    url.searchParams.set("lang", "en");
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("Lookup unavailable");
    const address = addressFromPhoton(await response.json());
    if (!address) return NextResponse.json({ message: "No address was found here. Please enter it manually." }, { status: 404, headers });
    return NextResponse.json({ address }, { headers });
  } catch {
    return NextResponse.json({ message: "Address lookup is unavailable. Please enter your address manually." }, { status: 502, headers });
  }
}
