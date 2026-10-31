import type { Prisma } from "@prisma/client";

export function loginIdentityWhere(loginId: string, portal?: "ADMIN" | "SUPPLIER" | "CUSTOMER"): Prisma.UserWhereInput {
  const identifier = loginId.trim();
  const identifiers: Prisma.UserWhereInput[] = [
    { email: { equals: identifier, mode: "insensitive" } },
    { loginId: identifier.toLowerCase() },
  ];
  // Preserve the original administrator login IDs without treating supplier display names as unique credentials.
  if (!portal || portal === "ADMIN") identifiers.push({ fullName: identifier });
  return { OR: identifiers, ...(portal === "ADMIN" ? { role: { in: ["ADMIN", "MANAGER"] } } : portal ? { role: portal } : {}) };
}
