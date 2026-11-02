import { prisma } from "./prisma";
import { decryptCredentials } from "./integration-crypto";

export const integrationFields = {
  RAZORPAY: ["keyId", "keySecret", "webhookSecret"],
  DELHIVERY: ["apiToken", "pickupLocation"],
  SHIPROCKET: ["email", "password", "pickupLocation"],
  AMAZON: ["sellerId", "marketplaceId", "clientId", "clientSecret", "refreshToken"],
  FLIPKART: ["sellerId", "clientId", "clientSecret"],
} as const;
export type IntegrationProvider = keyof typeof integrationFields;
export const integrationStore = {
  find(provider: IntegrationProvider) { return prisma.integrationSetting.findUnique({ where: { provider } }); },
};
export async function integrationCredentials(provider: IntegrationProvider) {
  const stored = await integrationStore.find(provider);
  return stored ? decryptCredentials(stored.encryptedCredentials) : {};
}
