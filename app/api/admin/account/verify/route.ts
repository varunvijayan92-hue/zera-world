import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE, getCurrentUser } from "@/lib/auth";
import { ADMIN_CHANGE_COOKIE, applyAdminAccountChange } from "@/lib/admin-account";
import { accountVerifySchema } from "@/lib/admin-account-validation";
import { isSameOriginRequest } from "@/lib/request-origin";
import { isProductionSecureContext } from "@/lib/site";
import { rateLimited } from "@/lib/rate-limit";
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ message: "Invalid origin." }, { status: 403 });
  const actor = await getCurrentUser();
  if (!actor || actor.role !== "ADMIN") return NextResponse.json({ message: "Administrator access required." }, { status: actor ? 403 : 401 });
  if (rateLimited(request, "admin-account-verify", 30)) return NextResponse.json({ message: "Too many attempts. Try again later." }, { status: 429 });
  const parsed = accountVerifySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Enter the six-digit code." }, { status: 400 });
  const store = await cookies();
  if (store.get(ADMIN_CHANGE_COOKIE)?.value !== parsed.data.challengeId) return NextResponse.json({ message: "Request a new code from this browser." }, { status: 400 });
  try {
    const changed = await applyAdminAccountChange(actor.id, parsed.data.challengeId, parsed.data.code);
    if (!changed) return NextResponse.json({ message: "Invalid or expired code. After five attempts, request a new code." }, { status: 400 });
    const response = NextResponse.json({ message: "Account updated. Sign in again with your updated details." });
    response.cookies.set(AUTH_COOKIE, "", { path: "/", httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", maxAge: 0 });
    response.cookies.set(ADMIN_CHANGE_COOKIE, "", { path: "/api/admin/account", httpOnly: true, secure: isProductionSecureContext(), sameSite: "lax", maxAge: 0 });
    return response;
  } catch (error) {
    const conflict = (error as { code?: string }).code === "P2002";
    return NextResponse.json({ message: conflict ? "Email or login ID is already in use. Start again with different details." : "Changes could not be saved. Please try again." }, { status: conflict ? 409 : 503 });
  }
}
