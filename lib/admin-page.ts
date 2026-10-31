import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export async function requireStoreAdmin() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) redirect("/admin/login");
  return user;
}
