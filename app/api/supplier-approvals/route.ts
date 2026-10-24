import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { supplierApprovalDecisionSchema } from "@/lib/validators";

export async function GET() {
  const approvals = await prisma.supplierApprovalDecision.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json({ data: approvals });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = supplierApprovalDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid approval payload." },
        { status: 400 }
      );
    }

    const existing = await prisma.supplierApprovalDecision.findUnique({
      where: { idempotencyKey: parsed.data.idempotencyKey },
    });

    const approval = existing
      ? await prisma.supplierApprovalDecision.update({
          where: { id: existing.id },
          data: {
            ...parsed.data,
            reviewedAt: new Date(),
            decisionReason: parsed.data.decisionReason || null,
            reviewerName: parsed.data.reviewerName || "Admin",
            status: parsed.data.status,
            action: parsed.data.action,
          },
        })
      : await prisma.supplierApprovalDecision.create({
          data: {
            ...parsed.data,
            reviewedAt: new Date(),
            decisionReason: parsed.data.decisionReason || null,
            reviewerName: parsed.data.reviewerName || "Admin",
            status: parsed.data.status,
            action: parsed.data.action,
          },
        });

    return NextResponse.json({ data: approval }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Approval record could not be saved." },
      { status: 500 }
    );
  }
}
