import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export const AUTH_COOKIE = "supplierbridge_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const AUTH_SECRET = process.env.JWT_SECRET || "supplierbridge-dev-secret";

export type SessionUser = {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  exp: number;
};

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  const base64 = globalThis.btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = globalThis.atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getSigningKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(AUTH_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function signSession(payload: Omit<SessionUser, "exp">) {
  const session: SessionUser = {
    ...payload,
    exp: Date.now() + SESSION_TTL_MS,
  };

  const json = JSON.stringify(session);
  const payloadBytes = new TextEncoder().encode(json);
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign("HMAC", key, payloadBytes);

  return `${encodeBase64Url(new Uint8Array(payloadBytes))}.${encodeBase64Url(new Uint8Array(signature))}`;
}

export async function verifySessionToken(token?: string): Promise<SessionUser | null> {
  if (!token) {
    return null;
  }

  try {
    const [payloadPart, signaturePart] = token.split(".");

    if (!payloadPart || !signaturePart) {
      return null;
    }

    const payloadBytes = decodeBase64Url(payloadPart);
    const payloadJson = new TextDecoder().decode(payloadBytes);
    const key = await getSigningKey();
    const providedSignature = decodeBase64Url(signaturePart);
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      key,
      providedSignature,
      payloadBytes
    );

    if (!validSignature) {
      return null;
    }

    const payload = JSON.parse(payloadJson) as SessionUser;

    if (!payload.userId || !payload.email || !payload.role || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

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

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return user;
}
