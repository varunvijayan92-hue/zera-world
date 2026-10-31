import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { contactSchema } from "../lib/contact";
import { storefrontNavigation, footerNavigation, isInternalPortal } from "../lib/storefront-navigation";
import { POST } from "../app/api/contact/route";

const details = { fullName: "Test Customer", email: "buyer@example.test", orderNumber: "ZW-TEST", subject: "Order enquiry", message: "Please check the delivery status of my order." };
const request = (body: unknown, origin = "https://store.example") => new Request("https://store.example/api/contact", { method: "POST", headers: { origin, "Content-Type": "application/json", "x-forwarded-for": "contact-unit-test" }, body: JSON.stringify(body) });

test("top navigation contains the four shopping links and all seven information links live in the footer", () => {
  assert.deepEqual(storefrontNavigation.map((entry) => entry.label), ["Home", "Shop", "Categories", "New Arrivals"]);
  assert.deepEqual(footerNavigation.map((entry) => entry.label), ["About Us", "Contact Us", "Privacy Policy", "Terms & Conditions", "Shipping Policy", "Return & Refund Policy", "Track Order"]);
  assert.equal(new Set(footerNavigation.map((entry) => entry.href)).size, 7);
  for (const path of ["/admin", "/admin/contact-messages", "/supplier/login", "/dashboard/orders"]) assert.equal(isInternalPortal(path), true);
  for (const path of ["/", "/about", "/contact", "/account", "/administrator"]) assert.equal(isInternalPortal(path), false);
});
test("contact validation requires real form details and accepts an optional order reference", () => {
  assert.equal(contactSchema.safeParse(details).success, true);
  assert.equal(contactSchema.safeParse({ ...details, orderNumber: undefined }).success, true);
  for (const patch of [{ fullName: " " }, { email: "invalid" }, { subject: "x" }, { message: "short" }, { message: "x".repeat(3001) }]) assert.equal(contactSchema.safeParse({ ...details, ...patch }).success, false);
});
test("contact API saves guest messages in the admin inbox and reports failures without claiming success", async (t) => {
  const previous = prisma.auditLog; let saved: unknown; let fail = false;
  Object.assign(prisma, { auditLog: { create: async (args: unknown) => { if (fail) throw Error("private database details"); saved = args; return {}; } } });
  t.after(() => Object.assign(prisma, { auditLog: previous }));
  assert.equal((await POST(request(details, "https://foreign.example"))).status, 403);
  assert.equal(saved, undefined);
  const invalid = await POST(request({ ...details, email: "invalid" })); assert.equal(invalid.status, 400); assert.equal(saved, undefined);
  const good = await POST(request(details)); assert.equal(good.status, 201);
  const response = await good.json(); assert.match(response.reference, /^CONTACT-/);
  const record = saved as unknown as { data: { action: string; details: unknown } };
  assert.equal(record.data.action, "CONTACT_REQUEST");
  assert.deepEqual(record.data.details, details);
  assert.equal((await POST(request({ ...details, website: "spam.example" }))).status, 200);
  assert.equal(saved, record);
  fail = true;
  const failed = await POST(request(details)); assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("private database details"), false);
  assert.equal((await POST(request(details))).status, 503);
  assert.equal((await POST(request(details))).status, 429);
});
