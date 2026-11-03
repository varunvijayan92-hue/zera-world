import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function CheckoutLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user?.role !== "CUSTOMER") redirect("/login?next=%2Fcheckout");
  return children;
}
