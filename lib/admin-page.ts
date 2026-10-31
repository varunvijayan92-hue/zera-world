import { redirect } from "next/navigation";
import { getCurrentUser } from "./auth";

export async function requireStoreAdmin() {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");
  return user;
}
