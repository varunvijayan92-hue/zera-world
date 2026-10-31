import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await portalUser("ADMIN", request); const { id } = await params;
    const parsed = z.object({ action: z.enum(["APPROVED", "REJECTED", "RECEIVED"]), notes: z.string().trim().max(2000).default("") }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Invalid return update.");
    await prisma.$transaction(async (tx) => {
      const current = await tx.returnRequest.findUnique({ where: { id } });
      if (!current) throw new AccessError("Return not found.", 404);
      const { action, notes } = parsed.data;
      if ((action === "RECEIVED" && current.status !== "APPROVED") || (action !== "RECEIVED" && current.status !== "OPEN")) throw new AccessError("Return status changed. Refresh before updating.", 409);
      await tx.returnRequest.update({ where: { id }, data: { status: action === "RECEIVED" ? "COMPLETED" : action, adminNotes: notes, ...(action === "RECEIVED" ? { receivedAt: new Date() } : {}) } });
      await tx.auditLog.create({ data: { userId: user.id, action: `RETURN_${action}`, entityType: "ReturnRequest", entityId: id } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ message: "Return updated. Refunds are processed separately after review." });
  } catch (error) { return apiError(error); }
}
