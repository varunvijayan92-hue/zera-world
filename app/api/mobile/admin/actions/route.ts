import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { fulfilmentPaymentWhere } from "@/lib/cash-on-delivery";

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
    decision: z.enum(["APPROVED", "REJECTED", "RECEIVED"]),
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
]);

export async function POST(request: Request) {
  try {
    const actor = await portalUser("ADMIN", request);
    const parsed = adminActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AccessError(parsed.error.issues[0]?.message || "Invalid admin action payload.");
    }
    const data = parsed.data;

    let message = "Action completed successfully.";

    await prisma.$transaction(async (tx) => {
      switch (data.action) {
        case "ORDER_DELIVERY": {
          const order = await tx.customerOrder.findUnique({ where: { id: data.orderId } });
          if (!order) throw new AccessError("Order not found.", 404);
          if (order.deliveredAt) throw new AccessError("Delivery is already confirmed.", 409);
          if (!["SHIPPED", "PROCESSING", "CONFIRMED"].includes(order.status)) {
            throw new AccessError("Only confirmed, processing or shipped orders can be delivered.");
          }
          const payment = await tx.paymentTransaction.findFirst({ where: fulfilmentPaymentWhere(data.orderId) });
          if (!payment) {
            throw new AccessError("Verified payment or confirmed COD order required before delivery confirmation.");
          }
          await tx.customerOrder.update({
            where: { id: data.orderId },
            data: {
              status: "DELIVERED",
              deliveredAt: new Date(),
              orderItems: { updateMany: { where: {}, data: { status: "DELIVERED", fulfillmentStatus: "DELIVERED" } } },
              shipments: { updateMany: { where: {}, data: { status: "DELIVERED" } } },
            },
          });
          message = "Order marked as DELIVERED.";
          break;
        }

        case "COD_COLLECTION": {
          const order = await tx.customerOrder.findUnique({ where: { id: data.orderId } });
          if (!order || order.status !== "DELIVERED" || !order.deliveredAt) {
            throw new AccessError("Confirm delivery before recording COD payment received.");
          }
          const payment = await tx.paymentTransaction.findFirst({ where: { orderId: data.orderId, provider: "COD" } });
          if (!payment) throw new AccessError("COD payment record not found.", 404);
          if (payment.paymentStatus !== "PAID") {
            await tx.paymentTransaction.update({
              where: { id: payment.id },
              data: {
                paymentStatus: "PAID",
                gatewayPaymentId: `COD:${data.reference}`,
                verificationTimestamp: new Date(),
              },
            });
          }
          message = "COD payment receipt recorded.";
          break;
        }

        case "ORDER_STATUS": {
          const order = await tx.customerOrder.findUnique({ where: { id: data.orderId } });
          if (!order) throw new AccessError("Order not found.", 404);
          await tx.customerOrder.update({
            where: { id: data.orderId },
            data: { status: data.status },
          });
          message = `Order status updated to ${data.status}.`;
          break;
        }

        case "RETURN_REVIEW": {
          const current = await tx.returnRequest.findUnique({ where: { id: data.returnId } });
          if (!current) throw new AccessError("Return request not found.", 404);
          const nextStatus = data.decision === "RECEIVED" ? "COMPLETED" : data.decision;
          await tx.returnRequest.update({
            where: { id: data.returnId },
            data: {
              status: nextStatus,
              adminNotes: data.notes,
              ...(data.decision === "RECEIVED" ? { receivedAt: new Date() } : {}),
            },
          });
          message = `Return request updated to ${nextStatus}.`;
          break;
        }

        case "PRODUCT_STATUS": {
          const product = await tx.product.findUnique({ where: { id: data.productId } });
          if (!product) throw new AccessError("Product not found.", 404);
          await tx.product.update({
            where: { id: data.productId },
            data: { status: data.status },
          });
          message = `Product status changed to ${data.status}.`;
          break;
        }

        case "PRODUCT_UPDATE": {
          const product = await tx.product.findUnique({ where: { id: data.productId } });
          if (!product) throw new AccessError("Product not found.", 404);

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
            const inv = await tx.inventory.findFirst({ where: { productId: data.productId } });
            if (inv) {
              await tx.inventory.update({
                where: { id: inv.id },
                data: { availableQty: data.stock },
              });
            } else {
              await tx.inventory.create({
                data: { productId: data.productId, availableQty: data.stock },
              });
            }
          }
          message = "Product and stock updated.";
          break;
        }

        case "USER_STATUS": {
          const user = await tx.user.findUnique({ where: { id: data.userId } });
          if (!user) throw new AccessError("User not found.", 404);
          if (user.id === actor.id) throw new AccessError("Cannot change your own account status.");
          await tx.user.update({
            where: { id: data.userId },
            data: { isActive: data.isActive },
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
          message = "Support ticket reply saved.";
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
      }

      await tx.auditLog.create({
        data: {
          userId: actor.id,
          action: `ADMIN_ACTION_${data.action}`,
          entityType: "AdminAction",
          entityId: actor.id,
        },
      });
    });

    return NextResponse.json({ success: true, message });
  } catch (error) {
    return apiError(error);
  }
}
