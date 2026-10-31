import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { adminLandingPath } from "@/lib/admin-navigation";

export default async function AdminPage() {
  const user = await getCurrentUser();
  redirect(adminLandingPath(user?.role));
}
