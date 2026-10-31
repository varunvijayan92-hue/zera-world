import { redirect } from "next/navigation";
import { supplierAccess, AccessError } from "@/lib/portal-access";
export const dynamic = "force-dynamic";
export default async function SuppliersEntryPage() {
  const access = await supplierAccess().catch((error) => { if (error instanceof AccessError) return null; throw error; });
  redirect(access ? "/suppliers/dashboard" : "/suppliers/login");
}
