export const AUTH_COOKIE = "supplierbridge_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
function getAuthSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return secret;
}

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
    new TextEncoder().encode(getAuthSecret()),
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
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadPart, signaturePart] = parts;

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

    if (typeof payload.userId !== "string" || !payload.userId || typeof payload.email !== "string" || !payload.email
      || !["ADMIN", "MANAGER", "SUPPLIER", "STAFF"].includes(payload.role)
      || typeof payload.exp !== "number" || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

