import { customerReorderProduct } from "@/lib/customer-reorder";
import { customerOrderTracking } from "@/lib/customer-tracking";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { portalUser, apiError, AccessError } from "@/lib/portal-access";
import { customerWhatsAppPhone } from "@/lib/customer-whatsapp";

export async function GET() {
  try {
    const user = await portalUser("CUSTOMER");
    const [profile, addresses, orders, tickets, vouchers] = await Promise.all([
      prisma.user.findUnique({ where: { id: user.id }, select: { fullName: true, email: true, phone: true, language: true, notificationsEnabled: true, whatsappPreference: { select: { enabled: true } } } }),
      prisma.customerAddress.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" } }),
      prisma.customerOrder.findMany({ where: { customerId: user.id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, marketplaceOrderId: true, status: true, totalAmount: true, deliveredAt: true, createdAt: true, orderItems: { select: { id: true, supplierId: true, selectedColor: true, selectedSize: true, status: true, fulfillmentStatus: true, quantity: true, unitPrice: true, isReturnable: true, returnDays: true, product: { select: { id: true, name: true, sku: true, status: true, sellingPrice: true, gstRate: true, handlingCharge: true, imageUrls: true, inventory: { where: { status: "AVAILABLE" }, select: { availableQty: true, reservedQty: true } } } } } }, shipments: { orderBy: { createdAt: "desc" }, select: { id: true, supplierId: true, trackingNumber: true, courierName: true, status: true, estimatedDelivery: true, trackingEvents: { orderBy: { eventTime: "desc" }, take: 20, select: { id: true, eventType: true, description: true, eventTime: true } } } }, returns: { select: { id: true, orderItemId: true, reason: true, quantity: true, status: true, adminNotes: true, refunds: { select: { id: true, amount: true, currency: true, status: true, gatewayRefundId: true } } } } } }),
      prisma.supportTicket.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.customerVoucher.findMany({ where: { customerId: user.id }, select: { code: true, balance: true, expiresAt: true } }),
    ]);
    const codPayments = await prisma.paymentTransaction.findMany({ where: { orderId: { in: orders.map(order => order.id) }, provider: "COD" }, select: { orderId: true, paymentStatus: true } });
    const customerOrders = orders.map(order => { const tracked = customerOrderTracking(order); return { ...tracked, orderItems: tracked.orderItems.map(item => ({ ...item, product: customerReorderProduct(order.orderItems.find(row => row.id === item.id)?.product) })), codPaymentStatus: codPayments.find(payment => payment.orderId === order.id)?.paymentStatus || null }; });
    return NextResponse.json({ profile: profile ? { ...profile, whatsappPreference: undefined, whatsappEnabled: profile.whatsappPreference?.enabled ?? false } : null, addresses, orders: customerOrders, tickets, vouchers }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PATCH(request: Request) {
  try {
    const user = await portalUser("CUSTOMER", request);
    const parsed = z.object({ fullName: z.string().trim().min(2).max(100), phone: z.string().trim().max(20), language: z.enum(["en", "hi", "ml", "ta", "kn", "te"]), notificationsEnabled: z.boolean(), whatsappEnabled: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AccessError("Check your profile details.");
    const { whatsappEnabled, ...profile } = parsed.data;
    const previous = await prisma.customerWhatsAppPreference.findUnique({ where: { userId: user.id } });
    const enabled = whatsappEnabled ?? previous?.enabled ?? false;
    const phone = enabled ? customerWhatsAppPhone.safeParse(profile.phone) : null;
    if (phone && !phone.success) throw new AccessError("Enter a valid Indian WhatsApp phone number to receive order updates.");
    const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { phone: true } });
    const nextPhone = phone?.success ? phone.data : profile.phone;
    await prisma.user.update({ where: { id: user.id, phone: current.phone }, data: { ...profile, phone: nextPhone,
      ...(current.phone !== nextPhone && { phoneVerifiedAt: null }),
      whatsappPreference: { upsert: { create: { enabled }, update: { enabled } } } } });
    return NextResponse.json({ message: "Profile and preferences saved." });
  } catch (error) { return apiError(error); }
}
