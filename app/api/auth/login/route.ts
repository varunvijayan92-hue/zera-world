import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProductionSecureContext } from "@/lib/site";

const loginSchema = z.object({
  loginId: z.string().min(1, "Login ID is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message || "Invalid login request." },
        { status: 400 }
      );
    }

    const { loginId, password } = parsed.data;
    const normalizedLoginId = loginId.trim();

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedLoginId }, { fullName: normalizedLoginId }],
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const cookieStore = await cookies();
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    });

    cookieStore.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: isProductionSecureContext(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Authentication failed.",
      },
      { status: 500 }
    );
  }
}
