import { rateLimited } from "@/lib/rate-limit";
import { isSameOriginRequest } from "@/lib/request-origin";
import { loginIdentityWhere } from "@/lib/login-identity";
import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";

import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isProductionSecureContext } from "@/lib/site";

const loginSchema = z.object({
  portal: z.enum(["CUSTOMER", "SUPPLIER", "ADMIN"]).optional(),
  loginId: z.string().min(1, "Login ID is required."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  if (rateLimited(request, "login")) return NextResponse.json({ message: "Too many login attempts. Try again later." }, { status: 429 });
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
      where: loginIdentityWhere(normalizedLoginId, parsed.data.portal),
    });

    if (!user || !user.isActive || (parsed.data.portal && (parsed.data.portal === "ADMIN" ? !["ADMIN", "MANAGER"].includes(user.role) : user.role !== parsed.data.portal))) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    if (parsed.data.portal === "SUPPLIER") {
      const access = await prisma.supplierContact.findFirst({ where: { userId: user.id, supplier: { status: "ACTIVE", sourceType: "DIRECT" } }, select: { id: true } });
      if (!access) return NextResponse.json({ message: "Your supplier access is awaiting approval or has been disabled." }, { status: 403 });
    }
    const token = await signSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      version: user.sessionVersion,
    });

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      },
    });

    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: isProductionSecureContext(),
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        message: "Authentication failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
