import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { CustomerAccount } from "@/components/customer-account";
export const dynamic = "force-dynamic";
export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "CUSTOMER") redirect("/login");
  return <CustomerAccount />;
}
