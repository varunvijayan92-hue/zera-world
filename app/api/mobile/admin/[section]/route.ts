import { mobileListQuery, mobileListMeta } from "@/lib/mobile-list";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { portalUser, AccessError, apiError } from "@/lib/portal-access";
import { financeReport } from "@/lib/finance-report";
import { integrationFields } from "@/lib/integration-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ section: string }> }) {
  try {
    await portalUser("ADMIN", request);
    const { section } = await context.params;
    let query;
    try { query = mobileListQuery(request); } catch (error) { throw new AccessError(error instanceof Error ? error.message : "Invalid pagination."); }
    const { page, limit, skip } = query;
    let data: unknown;

    switch (section) {
      case "dashboard":
        data = {
          ordersCount: await prisma.customerOrder.count(),
          productsCount: await prisma.product.count(),
          customersCount: await prisma.user.count({ where: { role: "CUSTOMER" } }),
          suppliersCount: await prisma.supplier.count(),
          shipmentsCount: await prisma.shipment.count(),
          returnsCount: await prisma.returnRequest.count(),
        };
        break;

      case "analytics": {
        const [pendingOrders, confirmedOrders, deliveredOrders, totalRevenueAgg] = await Promise.all([
          prisma.customerOrder.count({ where: { status: "PENDING" } }),
          prisma.customerOrder.count({ where: { status: "CONFIRMED" } }),
          prisma.customerOrder.count({ where: { status: "DELIVERED" } }),
          prisma.customerOrder.aggregate({ _sum: { totalAmount: true } }),
        ]);
        data = {
          pendingOrders,
          confirmedOrders,
          deliveredOrders,
          totalRevenue: totalRevenueAgg._sum.totalAmount || 0,
        };
        break;
      }

      case "products":
        data = await prisma.product.findMany({
          take: limit, skip,
          orderBy: { id: "desc" },
          select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            status: true,
            sellingPrice: true,
            costPrice: true,
            imageUrls: true,
            inventory: { select: { availableQty: true } },
            supplier: { select: { companyName: true } },
          },
        });
        break;

      case "orders":
        data = await prisma.customerOrder.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            marketplaceOrderId: true,
            customerName: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            orderItems: {
              select: {
                id: true,
                productId: true,
                marketplaceSku: true,
                quantity: true,
                unitPrice: true,
                fulfillmentStatus: true,
                supplierId: true,
              },
            },
          },
        });
        break;

      case "notifications":
        data = await prisma.orderItem.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            quantity: true,
            fulfillmentStatus: true,
            status: true,
            costPrice: true,
            product: { select: { name: true, sku: true } },
            customerOrder: { select: { id: true, marketplaceOrderId: true, status: true, createdAt: true } },
          },
        });
        break;

      case "contact-messages":
        data = await prisma.auditLog.findMany({
          where: { action: "CONTACT_REQUEST", entityType: "ContactMessage" },
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            entityId: true,
            details: true,
            createdAt: true,
          },
        });
        break;

      case "support":
        data = await prisma.supportTicket.findMany({ take: limit, skip, orderBy: { createdAt: "desc" },
          select: { id: true, subject: true, message: true, status: true, reply: true, createdAt: true, user: { select: { fullName: true, email: true } } } });
        break;

      case "customers":
        data = await prisma.user.findMany({
          where: { role: "CUSTOMER" },
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;

      case "inventory":
        data = await prisma.inventory.findMany({
          take: limit, skip,
          orderBy: { id: "asc" },
          select: {
            id: true,
            availableQty: true,
            reservedQty: true,
            damagedQty: true,
            incomingQty: true,
            status: true,
            product: { select: { id: true, sku: true, name: true } },
          },
        });
        break;

      case "returns":
        data = await prisma.returnRequest.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            customerOrderId: true,
            reason: true,
            quantity: true,
            status: true,
            refundAmount: true,
            returnType: true,
            adminNotes: true,
            supplierReceivedAt: true,
            createdAt: true,
          },
        });
        break;

      case "sellers": {
        const saved = await prisma.integrationSetting.findMany({ where: { provider: { in: ["AMAZON", "FLIPKART"] } }, select: { provider: true, updatedAt: true } });
        data = ["AMAZON", "FLIPKART"].map(provider => ({ provider, configured: saved.some(item => item.provider === provider),
          updatedAt: saved.find(item => item.provider === provider)?.updatedAt || null,
          fields: integrationFields[provider as "AMAZON" | "FLIPKART"], connectorEnabled: false,
          message: "Credentials can be saved. A live marketplace connector is not enabled." }));
        break;
      }
      case "suppliers":
        data = await prisma.supplier.findMany({
          take: limit, skip,
          orderBy: { id: "asc" },
          select: {
            id: true,
            companyName: true,
            contactName: true,
            email: true,
            phone: true,
            status: true,
            sourceType: true,
            pickupCity: true,
            pickupState: true,
          },
        });
        break;

      case "categories":
        data = await prisma.storeCategory.findMany({
          take: limit, skip,
          orderBy: { sortOrder: "asc" },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            imageUrl: true,
            imagePublicId: true,
            isVisible: true,
            sortOrder: true,
            parentId: true,
          },
        });
        break;

      case "fulfillment":
      case "tracking":
        data = await prisma.shipment.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            trackingNumber: true,
            courierName: true,
            status: true,
            createdAt: true,
            customerOrder: { select: { marketplaceOrderId: true, customerName: true } },
            trackingEvents: {
              take: 5,
              orderBy: { eventTime: "desc" },
              select: { eventType: true, description: true, eventTime: true },
            },
          },
        });
        break;

      case "product-sync":
        data = await prisma.syncJob.findMany({
          take: limit, skip,
          orderBy: { startedAt: "desc" },
          select: {
            id: true,
            jobType: true,
            status: true,
            startedAt: true,
            completedAt: true,
            errorMessage: true,
            createdAt: true,
          },
        });
        break;

      case "accounts": {
        const url = new URL(request.url);
        let p;
        try { p = await financeReport(url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined); }
        catch (error) { if (error instanceof Error && /date|range|start before/.test(error.message)) throw new AccessError(error.message); throw error; }
        const transactions = await prisma.paymentTransaction.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderId: true,
            provider: true,
            gatewayPaymentId: true,
            amount: true,
            currency: true,
            paymentStatus: true,
            createdAt: true,
          },
        });
        data = {
          profitAndLoss: {
            grossRevenue: p.gross,
            productCostsCOGS: p.costs,
            shippingCosts: p.shippingCosts,
            operatingExpenses: p.expenseTotal,
            refunds: p.refundTotal,
            gstLiability: p.gst,
            netProfitOrLoss: p.estimatedProfit,
          },
          transactions,
        };
        break;
      }

      case "payments":
        data = await prisma.paymentTransaction.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            orderId: true,
            provider: true,
            gatewayPaymentId: true,
            amount: true,
            currency: true,
            paymentStatus: true,
            createdAt: true,
          },
        });
        break;

      case "gift-cards":
        data = await prisma.customerVoucher.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            code: true,
            balance: true,
            expiresAt: true,
            createdAt: true,
            customer: { select: { fullName: true, email: true } },
          },
        });
        break;

      case "invoices":
        data = await prisma.customerOrder.findMany({
          where: { status: { in: ["CONFIRMED", "SHIPPED", "DELIVERED"] } },
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            marketplaceOrderId: true,
            customerName: true,
            totalAmount: true,
            subtotal: true,
            taxAmount: true,
            handlingAmount: true,
            shippingAmount: true,
            createdAt: true,
            deliveredAt: true,
            shippingAddress: true,
            orderItems: {
              select: {
                id: true,
                marketplaceSku: true,
                quantity: true,
                unitPrice: true,
                gstRate: true,
                product: { select: { name: true } },
              },
            },
          },
        });
        break;

      case "profit-expenses": {
        const url = new URL(request.url);
        let p;
        try { p = await financeReport(url.searchParams.get("from") || undefined, url.searchParams.get("to") || undefined); }
        catch (error) { if (error instanceof Error && /date|range|start before/.test(error.message)) throw new AccessError(error.message); throw error; }
        const expenses = await prisma.expense.findMany({
          take: limit, skip,
          orderBy: { expenseDate: "desc" },
          select: {
            id: true,
            category: true,
            description: true,
            amount: true,
            currency: true,
            expenseDate: true,
          },
        });
        data = {
          profitAndLoss: {
            grossRevenue: p.gross,
            productCostsCOGS: p.costs,
            shippingCosts: p.shippingCosts,
            operatingExpenses: p.expenseTotal,
            refunds: p.refundTotal,
            gstLiability: p.gst,
            netProfitOrLoss: p.estimatedProfit,
          },
          expenses,
        };
        break;
      }

      case "settings": {
        const saved = await prisma.integrationSetting.findMany({
          select: {
            id: true,
            provider: true,
            updatedAt: true,
          },
        });
        data = Object.entries(integrationFields).map(([provider, fields]) => ({
          provider, fields, configured: saved.some(item => item.provider === provider),
          updatedAt: saved.find(item => item.provider === provider)?.updatedAt || null,
        }));
        break;
      }

      case "users":
        data = await prisma.user.findMany({
          take: limit, skip,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
          },
        });
        break;

      default:
        throw new AccessError("Unknown admin section.", 404);
    }

    return NextResponse.json({ data, meta: mobileListMeta(data, page, limit) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
