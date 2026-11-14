import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIE, verifySessionToken, sessionVersionMatches } from "./session";
export { AUTH_COOKIE, signSession, verifySessionToken } from "./session";

async function currentDatabaseUser() {
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
      sessionVersion: true,
    },
  });

  if (!user || !user.isActive || !sessionVersionMatches(session, user.sessionVersion)) {
    return null;
  }

  return { id: user.id, email: user.email, fullName: user.fullName, role: user.role, isActive: user.isActive };
}

export const authContext = { current: currentDatabaseUser };
export async function getCurrentUser() { return authContext.current(); }
export async function getSession() {
  const user = await getCurrentUser();
  if (!user) return null;
  return { ...user, userId: user.id };
}
