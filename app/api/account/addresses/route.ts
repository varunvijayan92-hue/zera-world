import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkoutAddressSchema } from "@/lib/validators";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
export async function GET() {
  try {
    const user = await portalUser("CUSTOMER");
    return NextResponse.json({ addresses: await prisma.customerAddress.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const user = await portalUser("CUSTOMER", request);
    const parsed = z.object({ id: z.string().optional(), label: z.string().trim().min(1).max(50).default("Home"), address: checkoutAddressSchema }).safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Complete the delivery address.");
    const { id, ...data } = parsed.data;
    if (id) {
      const result = await prisma.customerAddress.updateMany({ where: { id, userId: user.id }, data });
      if (!result.count) throw new AccessError("Address not found.", 404);
    } else {
      await prisma.$transaction(async (tx) => {
        if (await tx.customerAddress.count({ where: { userId: user.id } }) >= 10) throw new AccessError("You can save up to 10 addresses.");
        await tx.customerAddress.create({ data: { ...data, userId: user.id } });
      }, { isolationLevel: "Serializable" });
    }
    return NextResponse.json({ message: "Address saved." });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const user = await portalUser("CUSTOMER", request);
    const { id } = z.object({ id: z.string().min(1) }).parse(await request.json());
    await prisma.customerAddress.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ message: "Address removed." });
  } catch (error) { return apiError(error); }
}
