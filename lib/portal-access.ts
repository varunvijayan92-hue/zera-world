import { getCurrentUser } from "./auth";
import { prisma } from "./prisma";
import { isSameOriginRequest } from "./request-origin";
import { NextResponse } from "next/server";

export class AccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export async function portalUser(role: "CUSTOMER" | "SUPPLIER" | "ADMIN", request?: Request) {
  if (request && !isSameOriginRequest(request)) throw new AccessError("Request origin rejected.", 403);
  const user = await getCurrentUser();
  if (!user) throw new AccessError("Sign in required.", 401);
  if (role === "ADMIN" ? !["ADMIN", "MANAGER"].includes(user.role) : user.role !== role) throw new AccessError("Access denied.", 403);
  return user;
}
export async function supplierAccess(request?: Request) {
  const user = await portalUser("SUPPLIER", request);
  const contact = await prisma.supplierContact.findFirst({ where: { userId: user.id, supplier: { status: "ACTIVE", sourceType: "DIRECT" } }, include: { supplier: true } });
  if (!contact) throw new AccessError("Your supplier account has not been approved.", 403);
  return { user, supplier: contact.supplier };
}
export function apiError(error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ message: "This record already exists. Refresh before submitting again." }, { status: 409 });
  return NextResponse.json({ message: error instanceof AccessError ? error.message : "The request could not be completed. Please try again." }, { status: error instanceof AccessError ? error.status : 500 });
}
