import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user: user ? { fullName: user.fullName, role: user.role } : null }, { headers: { "Cache-Control": "no-store" } });
}
