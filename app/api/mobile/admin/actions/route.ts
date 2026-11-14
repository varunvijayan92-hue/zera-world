import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { POST as confirmDelivery } from "@/app/api/admin/orders/[id]/delivery/route";
import { POST as collectCod } from "@/app/api/admin/orders/[id]/cod-collection/route";
import { POST as reviewReturn } from "@/app/api/admin/returns/[id]/route";
import { userAccessError } from "@/lib/admin-operations";
import { changePhotoOrder } from "@/lib/product-photos";

export const dynamic = "force-dynamic";

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("ORDER_DELIVERY"),
    orderId: z.string().min(1),
  }),
  z.object({
    action: z.literal("COD_COLLECTION"),
    orderId: z.string().min(1),
    reference: z.string().trim().min(3).max(150),
  }),
  z.object({
    action: z.literal("ORDER_STATUS"),
    orderId: z.string().min(1),
    status: z.enum(["CONFIRMED", "PROCESSING", "SHIPPED", "CANCELLED"]),
  }),
  z.object({
    action: z.literal("RETURN_REVIEW"),
    returnId: z.string().min(1),
    decision: z.enum(["APPROVED", "REJECTED", "COMPLETED"]),
    notes: z.string().trim().max(2000).default(""),
  }),
  z.object({
    action: z.literal("PRODUCT_STATUS"),
    productId: z.string().min(1),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
  }),
  z.object({
    action: z.literal("PRODUCT_UPDATE"),
    productId: z.string().min(1),
    sellingPrice: z.coerce.number().finite().min(0).optional(),
    costPrice: z.coerce.number().finite().min(0).optional(),
    stock: z.coerce.number().int().min(0).optional(),
  }),
  z.object({
    action: z.literal("USER_STATUS"),
    userId: z.string().min(1),
    isActive: z.boolean(),
  }),
  z.object({
    action: z.literal("SUPPORT_REPLY"),
    ticketId: z.string().min(1),
    reply: z.string().trim().min(1).max(3000),
    status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).default("RESOLVED"),
  }),
  z.object({
    action: z.literal("EXPENSE_CREATE"),
    category: z.string().trim().min(1).max(100),
    amount: z.coerce.number().finite().positive(),
    description: z.string().trim().max(1000).optional(),
  }),
  z.object({
    action: z.literal("PRODUCT_CREATE"),
    name: z.string().trim().min(2).max(150),
    sku: z.string().trim().min(1).max(80),
    category: z.string().trim().optional(),
    sellingPrice: z.coerce.number().finite().min(0).default(0),
    costPrice: z.coerce.number().finite().min(0).default(0),
    stock: z.coerce.number().int().min(0).default(0),
    description: z.string().max(5000).optional(),
    hsnCode: z.string().max(20).optional(),
    status: z.enum(["ACTIVE", "DRAFT"]).default("ACTIVE"),
    supplierId: z.string().optional(),
    imageUrl: z.string().url().optional(),
  }),
  z.object({
    action: z.literal("SUPPLIER_CREATE"),
    companyName: z.string().trim().min(2).max(150),
    contactName: z.string().trim().max(100).optional(),
    email: z.string().trim().email().max(200).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional(),
    sourceType: z.enum(["DIRECT", "EXTERNAL_SITE"]).default("DIRECT"),
    pickupAddress: z.string().trim().max(1000).optional(),
    pickupCity: z.string().trim().max(100).optional(),
    pickupState: z.string().trim().max(100).optional(),
    gstNumber: z.string().trim().max(50).optional(),
  }),
  z.object({
    action: z.literal("SUPPLIER_SETTLEMENT"),
    supplierId: z.string().min(1),
    amount: z.coerce.number().finite().positive(),
    reference: z.string().trim().min(2).max(100),
    notes: z.string().max(500).default(""),
    paidAt: z.string().optional(),
  }),
  z.object({
    action: z.literal("CATEGORY_CREATE"),
    name: z.string().trim().min(2).max(100),
    slug: z.string().trim().max(100).optional(),
    description: z.string().trim().max(1000).default(""),
    imageUrl: z.string().url().optional(),
    parentId: z.string().optional(),
  }),
  z.object({
    action: z.literal("CATEGORY_UPDATE"),
    categoryId: z.string().min(1),
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
    imageUrl: z.string().url().optional(),
    isVisible: z.boolean().optional(),
  }),
  z.object({
    action: z.literal("INVENTORY_UPDATE"),
    productId: z.string().min(1),
    availableQty: z.coerce.number().int().min(0),
  }),
  z.object({
    action: z.literal("VOUCHER_CREATE"),
    customerId: z.string().min(1),
    code: z.string().trim().min(3).max(50),
    balance: z.coerce.number().finite().positive(),
    expiresAt: z.string().optional(),
  }),
  z.object({
    action: z.literal("PHOTO_DELETE"),
    productId: z.string().min(1),
    photoUrl: z.string().url(),
  }),
  z.object({
    action: z.literal("PHOTO_COVER"),
    productId: z.string().min(1),
    photoUrl: z.string().url(),
  }),
  z.object({
    action: z.literal("CJ_SYNC"),
    syncType: z.enum(["orders", "products"]).default("orders"),
  }),
]);

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = adminActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new AccessError(parsed.error.issues[0]?.message || "Invalid admin action payload.");
    }
    const data = parsed.data;

    // Keep Android's response contract while sharing the web workflow safeguards.
    if (["ORDER_DELIVERY", "COD_COLLECTION", "RETURN_REVIEW"].includes(data.action)) {
      let response: Response;
      if (data.action === "RETURN_REVIEW") {
        const forwarded = new Request(request.url, { method: "POST", headers: request.headers,
          body: JSON.stringify({ action: data.decision === "COMPLETED" ? "RECEIVED" : data.decision, notes: data.notes }) });
        response = await reviewReturn(forwarded, { params: Promise.resolve({ id: data.returnId }) });
      } else if (data.action === "COD_COLLECTION") {
        const forwarded = new Request(request.url, { method: "POST", headers: request.headers, body: JSON.stringify({ reference: data.reference }) });
        response = await collectCod(forwarded, { params: Promise.resolve({ id: data.orderId }) });
      } else if (data.action === "ORDER_DELIVERY") {
        response = await confirmDelivery(request, { params: Promise.resolve({ id: data.orderId }) });
      } else throw new AccessError("Invalid workflow action.");
      return NextResponse.json({ ...await response.json(), success: response.ok }, { status: response.status });
    }

    let message = "Action completed successfully.";

    await prisma.$transaction(async (tx) => {
      switch (data.action) {
        case "ORDER_STATUS": {
          const order = await tx.customerOrder.findUnique({ where: { id: data.orderId } });
          if (!order) throw new AccessError("Order not found.", 404);
          if (order.status === data.status) break;
          const transitions: Record<string, string[]> = { PENDING: ["CONFIRMED", "CANCELLED"], CONFIRMED: ["PROCESSING", "CANCELLED"], PROCESSING: ["SHIPPED", "CANCELLED"] };
          if (!transitions[order.status]?.includes(data.status)) throw new AccessError("Invalid order transition. Refresh the order.", 409);
          if (data.status === "CANCELLED") throw new AccessError("Cancellation requires stock and payment reconciliation. Contact support before changing this order.", 409);
          if (!await tx.paymentTransaction.findFirst({ where: { orderId: order.id, OR: [{ paymentStatus: "PAID" }, { provider: "COD", paymentStatus: "PENDING" }] } })) throw new AccessError("Verified payment or confirmed COD order required.", 409);
          await tx.customerOrder.update({
            where: { id: data.orderId },
            data: { status: data.status },
          });
          message = `Order status updated to ${data.status}.`;
          break;
        }

        case "PRODUCT_STATUS": {
          const prod = await tx.product.findUnique({ where: { id: data.productId } });
          if (!prod) throw new AccessError("Product not found.", 404);
          await tx.product.update({
            where: { id: data.productId },
            data: { status: data.status },
          });
          message = `Product status changed to ${data.status}.`;
          break;
        }

        case "PRODUCT_UPDATE": {
          const prod = await tx.product.findUnique({
            where: { id: data.productId },
            include: { inventory: true },
          });
          if (!prod) throw new AccessError("Product not found.", 404);
          if (data.stock !== undefined && (prod.inventory.length > 1 || (prod.inventory[0] && data.stock < prod.inventory[0].reservedQty))) throw new AccessError("Use warehouse inventory controls; stock cannot be ambiguous or below reservations.", 409);

          const updateData: Record<string, unknown> = {};
          if (data.sellingPrice !== undefined) updateData.sellingPrice = data.sellingPrice;
          if (data.costPrice !== undefined) updateData.costPrice = data.costPrice;

          if (Object.keys(updateData).length > 0) {
            await tx.product.update({
              where: { id: data.productId },
              data: updateData,
            });
          }

          if (data.stock !== undefined) {
            if (prod.inventory.length > 0) {
              await tx.inventory.update({
                where: { id: prod.inventory[0].id },
                data: { availableQty: data.stock },
              });
            } else {
              await tx.inventory.create({
                data: {
                  productId: data.productId,
                  availableQty: data.stock,
                  supplierId: prod.supplierId,
                },
              });
            }
          }
          message = "Product details and inventory updated.";
          break;
        }

        case "USER_STATUS": {
          if (actor.role !== "ADMIN") throw new AccessError("Only administrators can manage user access.", 403);
          const user = await tx.user.findUnique({ where: { id: data.userId } });
          if (!user) throw new AccessError("User not found.", 404);
          const count = await tx.user.count({ where: { role: "ADMIN", isActive: true } });
          const accessError = userAccessError(actor.id, user, { role: user.role, isActive: data.isActive }, count);
          if (accessError) throw new AccessError(accessError);
          await tx.user.update({
            where: { id: data.userId },
            data: { isActive: data.isActive, sessionVersion: { increment: 1 } },
          });
          message = `User account ${data.isActive ? "activated" : "deactivated"}.`;
          break;
        }

        case "SUPPORT_REPLY": {
          const ticket = await tx.supportTicket.findUnique({ where: { id: data.ticketId } });
          if (!ticket) throw new AccessError("Support ticket not found.", 404);
          await tx.supportTicket.update({
            where: { id: data.ticketId },
            data: {
              reply: data.reply,
              status: data.status,
            },
          });
          message = "Support ticket reply posted.";
          break;
        }

        case "EXPENSE_CREATE": {
          await tx.expense.create({
            data: {
              category: data.category,
              amount: data.amount,
              description: data.description,
            },
          });
          message = "Expense voucher recorded.";
          break;
        }

        case "PRODUCT_CREATE": {
          const existing = await tx.product.findUnique({ where: { sku: data.sku } });
          if (existing) throw new AccessError("A product with this SKU already exists.", 409);
          const newProduct = await tx.product.create({
            data: {
              name: data.name,
              sku: data.sku,
              category: data.category || "General",
              sellingPrice: data.sellingPrice,
              costPrice: data.costPrice,
              description: data.description,
              hsnCode: data.hsnCode,
              status: data.status,
              imageUrls: data.imageUrl ? [data.imageUrl] : [],
              supplierId: data.supplierId || null,
              inventory: { create: { availableQty: data.stock, supplierId: data.supplierId || null } },
            },
          });
          message = `Product "${newProduct.name}" created successfully.`;
          break;
        }

        case "SUPPLIER_CREATE": {
          const supplier = await tx.supplier.create({
            data: {
              companyName: data.companyName,
              contactName: data.contactName,
              email: data.email || null,
              phone: data.phone,
              sourceType: data.sourceType,
              pickupAddress: data.pickupAddress,
              pickupCity: data.pickupCity,
              pickupState: data.pickupState,
              gstNumber: data.gstNumber,
              status: "ACTIVE",
            },
          });
          message = `Supplier "${supplier.companyName}" created successfully.`;
          break;
        }

        case "SUPPLIER_SETTLEMENT": {
          const supplier = await tx.supplier.findUnique({ where: { id: data.supplierId } });
          if (!supplier) throw new AccessError("Supplier not found.", 404);
          await tx.supplierSettlement.create({
            data: {
              supplierId: data.supplierId,
              amount: data.amount,
              reference: data.reference,
              notes: data.notes,
              paidAt: data.paidAt ? new Date(data.paidAt) : new Date(),
            },
          });
          message = `Settlement of INR ${data.amount} recorded for ${supplier.companyName}.`;
          break;
        }

        case "CATEGORY_CREATE": {
          const slug = data.slug || data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
          const existing = await tx.storeCategory.findFirst({
            where: { OR: [{ name: data.name }, { slug }] },
          });
          if (existing) throw new AccessError("A category with this name or slug already exists.", 409);
          const cat = await tx.storeCategory.create({
            data: {
              name: data.name,
              slug,
              description: data.description,
              imageUrl: data.imageUrl,
              parentId: data.parentId || null,
            },
          });
          message = `Category "${cat.name}" created successfully.`;
          break;
        }

        case "CATEGORY_UPDATE": {
          const cat = await tx.storeCategory.findUnique({ where: { id: data.categoryId } });
          if (!cat) throw new AccessError("Category not found.", 404);
          const updateData: Record<string, unknown> = {};
          if (data.name !== undefined) updateData.name = data.name;
          if (data.description !== undefined) updateData.description = data.description;
          if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
          if (data.isVisible !== undefined) updateData.isVisible = data.isVisible;

          await tx.storeCategory.update({
            where: { id: data.categoryId },
            data: updateData,
          });
          message = `Category "${cat.name}" updated successfully.`;
          break;
        }

        case "INVENTORY_UPDATE": {
          const prod = await tx.product.findUnique({
            where: { id: data.productId },
            include: { inventory: true },
          });
          if (!prod) throw new AccessError("Product not found.", 404);
          if (prod.inventory.length > 1 || (prod.inventory[0] && data.availableQty < prod.inventory[0].reservedQty)) throw new AccessError("Use warehouse inventory controls; stock cannot be ambiguous or below reservations.", 409);
          if (prod.inventory.length > 0) {
            await tx.inventory.update({
              where: { id: prod.inventory[0].id },
              data: { availableQty: data.availableQty },
            });
          } else {
            await tx.inventory.create({
              data: {
                productId: data.productId,
                availableQty: data.availableQty,
                supplierId: prod.supplierId,
              },
            });
          }
          message = `Inventory for ${prod.name} updated to ${data.availableQty} units.`;
          break;
        }

        case "VOUCHER_CREATE": {
          const customer = await tx.user.findUnique({ where: { id: data.customerId } });
          if (!customer) throw new AccessError("Customer not found.", 404);
          const existing = await tx.customerVoucher.findUnique({ where: { code: data.code } });
          if (existing) throw new AccessError("A voucher with this code already exists.", 409);

          await tx.customerVoucher.create({
            data: {
              customerId: data.customerId,
              code: data.code,
              balance: data.balance,
              expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            },
          });
          message = `Voucher ${data.code} of INR ${data.balance} created.`;
          break;
        }

        case "PHOTO_DELETE": {
          const prod = await tx.product.findUnique({
            where: { id: data.productId },
            select: { id: true, imageUrls: true },
          });
          if (!prod) throw new AccessError("Product not found.", 404);
          const nextUrls = changePhotoOrder(prod.imageUrls, data.photoUrl, "remove");
          await tx.product.update({
            where: { id: data.productId },
            data: { imageUrls: nextUrls },
          });
          message = "Photo removed from product.";
          break;
        }

        case "PHOTO_COVER": {
          const prod = await tx.product.findUnique({
            where: { id: data.productId },
            select: { id: true, imageUrls: true },
          });
          if (!prod) throw new AccessError("Product not found.", 404);
          const nextUrls = changePhotoOrder(prod.imageUrls, data.photoUrl, "cover");
          await tx.product.update({
            where: { id: data.productId },
            data: { imageUrls: nextUrls },
          });
          message = "Photo set as cover photo.";
          break;
        }

        case "CJ_SYNC": {
          throw new AccessError("Use the CJ integration sync endpoint; no sync job has been queued.", 409);
        }
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: `ADMIN_ACTION_${data.action}`,
          entityType: "AdminAction",
          entityId: actor.id,
        },
      });
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return apiError(error);
  }
}
