import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AccessError, apiError, supplierAccess } from "@/lib/portal-access";
import { isSameOriginRequest } from "@/lib/request-origin";
import { trackShiprocket } from "@/lib/shiprocket";
import { trackDelhivery } from "@/lib/delhivery";
import { rateLimited } from "@/lib/rate-limit";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!isSameOriginRequest(request)) throw new AccessError("Invalid origin.", 403);
    const user = await getCurrentUser(); if (!user) throw new AccessError("Sign in required.", 401);
    if (rateLimited(request, `tracking:${user.id}`, 30, 60000)) throw new AccessError("Wait before refreshing tracking again.", 429);
    const { id } = await params; const supplier = user.role === "SUPPLIER" ? (await supplierAccess()).supplier : null;
    const shipment = await prisma.shipment.findFirst({ where: { id, ...(["ADMIN", "MANAGER"].includes(user.role) ? {} : supplier ? { supplierId: supplier.id } : user.role === "CUSTOMER" ? { customerOrder: { customerId: user.id } } : { id: "DENIED" }) } });
    if (!shipment || !shipment.trackingNumber) throw new AccessError("Shipment not found.", 404);
    const carrier = shipment.courierName?.toLowerCase();
    if (carrier !== "delhivery" && carrier !== "shiprocket") throw new AccessError("Live tracking supports Shiprocket and Delhivery shipments.");
    const result = await (carrier === "shiprocket" ? trackShiprocket : trackDelhivery)(shipment.trackingNumber);
    // Keep provider status as an event; delivery confirmation remains an audited admin action.
    await prisma.$transaction(async (tx) => {
      for (const scan of result.scans) {
        if (!await tx.trackingEvent.findFirst({ where: { shipmentId: id, eventType: scan.type, eventTime: scan.date } })) await tx.trackingEvent.create({ data: { shipmentId: id, eventType: scan.type, description: scan.description, eventTime: scan.date } });
      }
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: `${shipment.courierName}: ${result.status}. Tracking events refreshed.`, tracking: result });
  } catch (error) { return apiError(error); }
}
