import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AccessError, apiError, portalUser } from "@/lib/portal-access";
import { rateLimited } from "@/lib/rate-limit";
import { sendSupportReply } from "@/lib/support-inbox";

export const dynamic = "force-dynamic";
const threadId = z.string().regex(/^[a-f0-9]{64}$/);
const reply = z.object({ thread: threadId, replyId: z.string().uuid(), body: z.string().trim().min(1).max(4096) });
const publicFields = {
  id: true, thread: true, channel: true, peer: true, subject: true, body: true, direction: true, status: true, createdAt: true,
} as const;

export async function GET(request: Request) {
  try {
    await portalUser("ADMIN", request);
    const query = new URL(request.url).searchParams;
    const thread = query.get("thread");
    const channel = query.get("channel");
    if (channel && channel !== "EMAIL" && channel !== "WHATSAPP") throw new AccessError("Invalid message channel.");
    if (thread && !threadId.safeParse(thread).success) throw new AccessError("Invalid conversation.");
    const data = thread
      ? (await prisma.supportMessage.findMany({
          where: { thread }, select: publicFields, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 100,
        })).reverse()
      : await prisma.$queryRaw`SELECT * FROM (
          SELECT DISTINCT ON ("thread") "id", "thread", "channel", "peer", "subject", "body", "direction", "status", "createdAt"
          FROM "SupportMessage" WHERE (${channel || null}::text IS NULL OR "channel" = ${channel || null})
          ORDER BY "thread", "createdAt" DESC, "id" DESC
        ) AS conversations ORDER BY "createdAt" DESC, "id" DESC LIMIT 100`;
    return NextResponse.json({ data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const user = await portalUser("ADMIN", request);
    const input = reply.safeParse(await request.json().catch(() => null));
    if (!input.success) throw new AccessError("Enter a reply between 1 and 4096 characters.");
    if (rateLimited(request, `support-reply:${user.id}`, 15, 60000)) throw new AccessError("Wait before sending more replies.", 429);
    await sendSupportReply(input.data.thread, input.data.replyId, input.data.body, user.id);
    return NextResponse.json({ message: "Reply accepted by the provider." });
  } catch (error) { return apiError(error); }
}
