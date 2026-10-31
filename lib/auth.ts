import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, verifySessionToken } from "./session";
export { AUTH_COOKIE, signSession, verifySessionToken } from "./session";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}
