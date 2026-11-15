import test from "node:test";
import assert from "node:assert/strict";
import { customerRegistrationSchema, customerWhatsAppPhone } from "../lib/customer-whatsapp";
import { PATCH } from "../app/api/account/route";
import { prisma } from "../lib/prisma";
import { authContext } from "../lib/auth";

test("registration requires a valid phone number and WhatsApp consent defaults to false", () => {
  const input = { fullName: "Test buyer", email: "buyer@example.test", password: "long-test-password", phone: "+91 98765 43210" };
  const parsed = customerRegistrationSchema.parse(input);
  assert.equal(parsed.phone, "9876543210"); assert.equal(parsed.whatsappEnabled, false);
  assert.equal(customerRegistrationSchema.safeParse({ ...input, phone: "" }).success, false);
  assert.equal(customerWhatsAppPhone.safeParse("0000000000").success, false);
});

test("customers can opt in and out while enabled updates require a valid destination", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "customer", role: "CUSTOMER", isActive: true }));
  const originalUser = prisma.user, originalPreference = prisma.customerWhatsAppPreference;
  let writes = 0, enabled = false;
  Object.assign(prisma, { customerWhatsAppPreference: { findUnique: async () => ({ enabled }) }, user: { update: async ({ where, data }: any) => {
    assert.equal(where.id, "customer"); enabled = data.whatsappPreference.upsert.update.enabled;
    if (enabled) assert.equal(data.phone, "9876543210"); writes++; return {};
  } } });
  t.after(() => Object.assign(prisma, { user: originalUser, customerWhatsAppPreference: originalPreference }));
  const request = (phone: string, whatsappEnabled: boolean) => new Request("https://store.test/api/account", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: "Test buyer", phone, language: "en", notificationsEnabled: true, whatsappEnabled }) });
  assert.equal((await PATCH(request("", true))).status, 400); assert.equal(writes, 0);
  assert.equal((await PATCH(request("+919876543210", true))).status, 200); assert.equal(enabled, true);
  assert.equal((await PATCH(request("", false))).status, 200); assert.equal(enabled, false);
});
