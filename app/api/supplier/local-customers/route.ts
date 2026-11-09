import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { supplierAccess, AccessError, apiError } from "@/lib/portal-access";
import { supplierLocalCustomerSchema } from "@/lib/supplier-local-customers";

async function save(request: Request, edit: boolean) {
  try {
    const { supplier, user } = await supplierAccess(request);
    const raw = await request.json().catch(() => null);
    const parsed = supplierLocalCustomerSchema.safeParse(raw);
    if (!parsed.success) throw new AccessError(parsed.error.issues[0]?.message || "Check the customer details.");
    const id = edit ? z.string().min(1).max(100).safeParse(raw?.id) : null;
    if (edit && !id?.success) throw new AccessError("Select a customer to update.");
    const data = { name: parsed.data.name, phone: parsed.data.phone || null, email: parsed.data.email.toLowerCase() || null, address: parsed.data.address || null, notes: parsed.data.notes || null };
    const customer = await prisma.$transaction(async tx => {
      if (id?.success) {
        const result = await tx.supplierLocalCustomer.updateMany({ where: { id: id.data, supplierId: supplier.id }, data });
        if (!result.count) throw new AccessError("Customer not found.", 404);
      }
      const record = id?.success ? await tx.supplierLocalCustomer.findFirstOrThrow({ where: { id: id.data, supplierId: supplier.id } }) : await tx.supplierLocalCustomer.create({ data: { ...data, supplierId: supplier.id } });
      await tx.auditLog.create({ data: { userId: user.id, action: id?.success ? "UPDATE_SUPPLIER_LOCAL_CUSTOMER" : "CREATE_SUPPLIER_LOCAL_CUSTOMER", entityType: "SupplierLocalCustomer", entityId: record.id, details: { supplierId: supplier.id } } });
      return record;
    });
    revalidatePath("/suppliers/local-customers"); revalidatePath("/admin/suppliers/local-customers");
    return NextResponse.json({ data: customer, message: edit ? "Customer updated." : "Customer added." }, { status: edit ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export function POST(request: Request) { return save(request, false); }
export function PATCH(request: Request) { return save(request, true); }
