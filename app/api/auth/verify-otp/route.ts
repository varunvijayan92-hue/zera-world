import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { AUTH_COOKIE, signSession } from "@/lib/auth";
import { consumeCustomerOtp, OTP_COOKIE } from "@/lib/customer-otp";
import { isSameOriginRequest } from "@/lib/request-origin";
import { rateLimited } from "@/lib/rate-limit";
import { isProductionSecureContext } from "@/lib/site";

const schema = z.object({ challengeId: z.string().regex(/^[a-f0-9]{64}$/), code: z.string().regex(/^\d{6}$/) });
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  if (rateLimited(request, "verify-otp", 30)) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter the six-digit email code." }, { status: 400 });
  const store = await cookies();
  if (store.get(OTP_COOKIE)?.value !== parsed.data.challengeId) return NextResponse.json({ message: "Start signing in again in this browser." }, { status: 400 });
  try {
    const user = await consumeCustomerOtp(parsed.data.challengeId, parsed.data.code);
    if (!user) return NextResponse.json({ message: "Invalid or expired code. After five attempts, request a new code." }, { status: 400 });
    if (user.otpPurpose === "REGISTER") {
      const response = NextResponse.json({ success: true, message: "Account verified. You can now sign in with your email and password." });
      response.cookies.set(OTP_COOKIE, "", { httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", path: "/api/auth", maxAge: 0 });
      return response;
    }
    const token = await signSession({ userId: user.id, email: user.email, role: user.role, fullName: user.fullName, version: user.sessionVersion });
    const response = NextResponse.json({ success: true, message: "Verified. Welcome back." });
    response.cookies.set(AUTH_COOKIE, token, { httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
    response.cookies.set(OTP_COOKIE, "", { httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", path: "/api/auth", maxAge: 0 });
    return response;
  } catch { return NextResponse.json({ message: "Verification is unavailable. Please try again." }, { status: 503 }); }
}
