import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { databaseSchemaReady, databaseTargetFingerprint } from "@/lib/database-readiness";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const ready = await databaseSchemaReady();
    return NextResponse.json({ status: ready ? "ok" : "migration_pending", db: "connected", version: "store-portals-v1", commit: process.env.VERCEL_GIT_COMMIT_SHA || null, databaseTarget: databaseTargetFingerprint() }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        db: "disconnected",
        message: "Database connection failed.",
      },
      { status: 500 }
    );
  }
}
