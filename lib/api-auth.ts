import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";

export async function authorizeManagement() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ message: "Management access required." }, { status: 403 });
  }
  return null;
}
