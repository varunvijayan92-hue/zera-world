import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { adminNavigation } from "@/lib/admin-navigation";
import { supplierNavigation } from "@/lib/supplier-navigation";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AccessError("Sign in required.", 401);
    if (user.role === "ADMIN" || user.role === "MANAGER") {
      return NextResponse.json({
        role: user.role,
        groups: adminNavigation.map(group => ({
          label: group.label,
          items: group.items.map(item => ({
            id: item.href.slice("/admin/".length),
            label: item.label,
          })),
        })),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (user.role === "SUPPLIER") {
      await supplierAccess();
      return NextResponse.json({
        role: user.role,
        groups: supplierNavigation.map(([label, entries]) => ({
          label,
          items: entries.map(([name, id]) => ({ id, label: name })),
        })),
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    throw new AccessError("Portal access required.", 403);
  } catch (error) {
    return apiError(error);
  }
}
