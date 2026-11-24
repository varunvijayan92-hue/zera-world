import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptCredentials, decryptCredentials } from "@/lib/integration-crypto";
import { integrationFields } from "@/lib/integration-settings";
import { AccessError, apiError } from "@/lib/portal-access";
import { isSameOriginRequest } from "@/lib/request-origin";

const schema = z.object({ provider: z.enum(["RAZORPAY", "DELHIVERY", "SHIPROCKET", "CJ_DROPSHIPPING", "AMAZON", "FLIPKART", "META_WHATSAPP"]), credentials: z.record(z.string().max(4096)) });
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "ADMIN" || !isSameOriginRequest(request)) throw new AccessError("Administrator access required.", 403);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) throw new AccessError("Check the integration fields.");
    const { provider, credentials } = parsed.data;
    const existing = await prisma.integrationSetting.findUnique({ where: { provider } });
    const merged = existing ? decryptCredentials(existing.encryptedCredentials) : {};
    for (const key of integrationFields[provider]) {
      const value = provider === "SHIPROCKET" && key === "password" ? credentials[key] : credentials[key]?.trim();
      if (value) merged[key] = value;
    }
    const required = integrationFields[provider].filter((key) => provider !== "META_WHATSAPP" && !["webhookSecret", "pickupLocation", "orderTemplateId", "paymentTemplateId", "shippedTemplateId", "deliveredTemplateId"].includes(key));
    if (required.some((key) => !merged[key])) throw new AccessError("Complete the required API credentials. Blank fields preserve previously saved values.");
    if (provider === "SHIPROCKET" && !z.string().email().safeParse(merged.email).success) throw new AccessError("Enter a valid Shiprocket API user email.");
    if (provider === "META_WHATSAPP") {
      const { accessToken, wabaId, phoneNumberId, verifyToken, templateLanguage, signupOtpLanguage, signupOtpEnabled } = merged;
      const senderFields = [accessToken, wabaId, phoneNumberId];
      if (signupOtpEnabled && !["true", "false"].includes(signupOtpEnabled)) throw new AccessError("Choose a valid signup verification setting.");
      if (signupOtpEnabled === "true" && !senderFields.every(Boolean)) throw new AccessError("Save the Meta sender credentials before enabling WhatsApp signup verification.");
      if (senderFields.some(Boolean) && !senderFields.every(Boolean)) throw new AccessError("Enter the Meta access token, WhatsApp Business Account ID and phone number ID together.");
      if (!accessToken && !verifyToken) throw new AccessError("Enter Meta sender credentials or a webhook verify token.");
      if ([wabaId, phoneNumberId].some(id => id && !/^\d{5,30}$/.test(id))) throw new AccessError("Use the numeric IDs shown in Meta API Setup.");
      if (verifyToken && verifyToken.length < 32) throw new AccessError("Use a webhook verify token of at least 32 characters.");
      if ([templateLanguage, signupOtpLanguage].some(language => language && !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(language))) throw new AccessError("Use a Meta language code such as en_US.");
      if (["orderTemplate", "paymentTemplate", "shippedTemplate", "deliveredTemplate", "signupOtpTemplate"].some(key => merged[key] && !/^[a-z0-9_]{1,512}$/.test(merged[key]))) throw new AccessError("Use the exact template names from WhatsApp Manager.");
    }
    const encryptedCredentials = encryptCredentials(merged);
    await prisma.$transaction([
      prisma.integrationSetting.upsert({ where: { provider }, create: { provider, encryptedCredentials }, update: { encryptedCredentials } }),
      prisma.auditLog.create({ data: { userId: user.id, action: "UPDATE_INTEGRATION", entityType: "IntegrationSetting", entityId: provider, details: { provider } } }),
    ]);
    return NextResponse.json({ message: provider === "META_WHATSAPP" ? "Meta WhatsApp settings saved securely." : "Credentials saved securely. Saving does not verify partner access." });
  } catch (error) { return apiError(error); }
}
