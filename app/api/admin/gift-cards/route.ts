import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { giftCardSchema, giftCardExpiry } from "@/lib/gift-cards";

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    if (actor.role !== "ADMIN") throw new AccessError("Only administrators can issue gift cards.", 403);
    const parsed = giftCardSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check the gift card details.");
    const { customerEmail, code, amount, expiresOn } = parsed.data;
    let expiresAt: Date | null;
    try { expiresAt = giftCardExpiry(expiresOn); } catch (error) { throw new AccessError(error instanceof Error ? error.message : "Check the expiry date."); }
    const card = await prisma.$transaction(async tx => {
      const customer = await tx.user.findFirst({ where: { email: { equals: customerEmail, mode: "insensitive" }, role: "CUSTOMER", isActive: true }, select: { id: true, fullName: true, email: true } });
      if (!customer) throw new AccessError("An active registered customer with this email was not found.", 404);
      const saved = await tx.customerVoucher.create({ data: { customerId: customer.id, code, balance: amount.toFixed(2), expiresAt } });
      await tx.auditLog.create({ data: { userId: actor.id, action: "ISSUE_GIFT_CARD", entityType: "CustomerVoucher", entityId: saved.id, details: { customerId: customer.id, amount, expiresAt: expiresAt?.toISOString() || null, codeSuffix: code.slice(-4) } } });
      return { ...saved, customer };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ data: card, message: "Gift card created and added to the customer account." }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ message: "This gift-card code already exists. Check the issued cards before creating another." }, { status: 409 });
    return apiError(error);
  }
}
