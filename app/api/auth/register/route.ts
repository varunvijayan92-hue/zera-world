import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";

const schema = z.object({ fullName: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()), password: z.string().min(12).refine((value) => Buffer.byteLength(value, "utf8") <= 72) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  if (rateLimited(request, "register", 10)) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter your name, a valid email and a password of 12–72 bytes." }, { status: 400 });
  try {
    if (await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: "insensitive" } } })) return NextResponse.json({ message: "This email cannot be registered. Try signing in." }, { status: 409 });
    await prisma.user.create({ data: { fullName: parsed.data.fullName, email: parsed.data.email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: "CUSTOMER" } });
    return NextResponse.json({ message: "Account created. Sign in to continue." }, { status: 201 });
  } catch { return NextResponse.json({ message: "Account could not be created." }, { status: 409 }); }
}
