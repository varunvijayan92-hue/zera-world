import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/request-origin";
import { prisma } from "@/lib/prisma";
import { cjOrderPolicySchema } from "@/lib/cj-order-policy";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN" || !isSameOriginRequest(request)) return NextResponse.json({ message: "Administrator access required." }, { status: 403 });
  const parsed = cjOrderPolicySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message || "Check the shipping settings." }, { status: 400 });
  const saved = await prisma.integrationSetting.findUnique({ where: { provider: "CJ_DROPSHIPPING" }, select: { options: true } });
  if (!saved) return NextResponse.json({ message: "Save the CJ API key first." }, { status: 400 });
  const previous = saved.options && typeof saved.options === "object" && !Array.isArray(saved.options) ? saved.options : {};
  await prisma.$transaction([
    prisma.integrationSetting.update({ where: { provider: "CJ_DROPSHIPPING" }, data: { options: { ...previous, orderPolicy: parsed.data } } }),
    prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE_CJ_ORDER_POLICY", entityType: "IntegrationSetting", entityId: "CJ_DROPSHIPPING", details: { origin: parsed.data.origin, trackedMethods: parsed.data.trackedMethods } } }),
  ]);
  return NextResponse.json({ message: "Shipping settings saved. Automatic CJ ordering is not active yet." });
}
