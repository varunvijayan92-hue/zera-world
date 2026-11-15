import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRecentAlertLogs } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session || !["ADMIN", "MANAGER", "SUPPLIER"].includes(session.role)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const alerts = getRecentAlertLogs(50);
  return NextResponse.json({
    data: alerts,
    count: alerts.length,
  });
}
