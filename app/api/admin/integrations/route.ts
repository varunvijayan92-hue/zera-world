import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredentials, decryptCredentials } from "@/lib/integration-crypto";
import { integrationFields } from "@/lib/integration-settings";
import { AccessError, apiError } from "@/lib/portal-access";
import { isSameOriginRequest } from "@/lib/request-origin";

const schema = z.object({ provider: z.enum(["RAZORPAY", "DELHIVERY", "SHIPROCKET", "CJ_DROPSHIPPING", "FAST2SMS_WHATSAPP", "AMAZON", "FLIPKART"]), credentials: z.record(z.string().max(4096)) });
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN" || !isSameOriginRequest(request)) throw new AccessError("Administrator access required.", 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Check the integration fields.");
    const { provider, credentials } = parsed.data;
    const existing = await prisma.integrationSetting.findUnique({ where: { provider } });
    const merged = existing ? decryptCredentials(existing.encryptedCredentials) : {};
    if (provider === "FAST2SMS_WHATSAPP") {
      merged.apiKey ||= process.env.FAST2SMS_API_KEY || "";
      merged.phoneNumberId ||= process.env.FAST2SMS_WHATSAPP_PHONE_NUMBER_ID || "";
    }
    for (const key of integrationFields[provider]) {
      const value = provider === "SHIPROCKET" && key === "password" ? credentials[key] : credentials[key]?.trim();
      if (value) merged[key] = value;
    }
    const required = integrationFields[provider].filter((key) => !["webhookSecret", "pickupLocation", "orderTemplateId", "paymentTemplateId", "shippedTemplateId", "deliveredTemplateId"].includes(key));
    if (required.some((key) => !merged[key])) throw new AccessError("Complete the required API credentials. Blank fields preserve previously saved values.");
    if (provider === "SHIPROCKET" && !z.string().email().safeParse(merged.email).success) throw new AccessError("Enter a valid Shiprocket API user email.");
    if (provider === "FAST2SMS_WHATSAPP" && !/^\d{5,30}$/.test(merged.phoneNumberId)) throw new AccessError("Enter the WhatsApp phone number ID from Fast2SMS, not a mobile number.");
    if (provider === "FAST2SMS_WHATSAPP" && ["orderTemplateId", "paymentTemplateId", "shippedTemplateId", "deliveredTemplateId"].some(key => merged[key] && !/^\d{1,20}$/.test(merged[key]))) throw new AccessError("Use the numeric Fast2SMS message ID for each template.");
    const encryptedCredentials = encryptCredentials(merged);
    await prisma.$transaction([
      prisma.integrationSetting.upsert({ where: { provider }, create: { provider, encryptedCredentials }, update: { encryptedCredentials } }),
      prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE_INTEGRATION", entityType: "IntegrationSetting", entityId: provider, details: { provider } } }),
    ]);
    return NextResponse.json({ message: "Credentials saved securely. Saving does not verify partner access." });
  } catch (error) { return apiError(error); }
}
