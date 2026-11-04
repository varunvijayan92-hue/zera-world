import { NextResponse } from "next/server";
import { portalUser, apiError } from "@/lib/portal-access";
import { prisma } from "@/lib/prisma";
export async function GET() {
  try {
    const user = await portalUser("CUSTOMER");
    const cards = await prisma.customerVoucher.findMany({ where: { customerId: user.id, balance: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { code: true, balance: true, expiresAt: true }, orderBy: { createdAt: "desc" } });
    return NextResponse.json({ cards }, { headers: { "Cache-Control": "no-store, private" } });
  } catch (error) { return apiError(error); }
}
