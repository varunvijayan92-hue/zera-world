import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const readiness = await prisma.$queryRaw<{ ready: boolean }[]>`SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'StoreCategory' AND column_name = 'imageUrl') AND EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'IntegrationSetting') AS ready`;
    const ready = readiness[0]?.ready === true;
    return NextResponse.json({ status: ready ? "ok" : "migration_pending", db: "connected", version: "store-portals-v1", commit: process.env.VERCEL_GIT_COMMIT_SHA || null }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
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
