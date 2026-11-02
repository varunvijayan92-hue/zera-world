import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { contactSchema, publicSupportDetails } from "../lib/contact";
import { storefrontNavigation, footerNavigation, isInternalPortal } from "../lib/storefront-navigation";
import { POST } from "../app/api/contact/route";
import { emailDelivery } from "../lib/email";

const details = { fullName: "Test Customer", email: "buyer@example.test", orderNumber: "ZW-TEST", subject: "Order enquiry", message: "Please check the delivery status of my order." };
const request = (body: unknown, origin = "https://store.example") => new Request("https://store.example/api/contact", { method: "POST", headers: { origin, "Content-Type": "application/json", "x-forwarded-for": "contact-unit-test" }, body: JSON.stringify(body) });

test("top navigation contains the four shopping links and all seven information links live in the footer", () => {
  assert.deepEqual(storefrontNavigation.map((entry) => entry.label), ["Home", "Shop", "Categories", "New Arrivals"]);
  assert.deepEqual(footerNavigation.map((entry) => entry.label), ["About Us", "Contact Us", "Privacy Policy", "Terms & Conditions", "Shipping Policy", "Return & Refund Policy", "Track Order"]);
  assert.equal(new Set(footerNavigation.map((entry) => entry.href)).size, 7);
  for (const path of ["/admin", "/admin/contact-messages", "/supplier/login", "/suppliers/login", "/suppliers/dashboard", "/dashboard/orders"]) assert.equal(isInternalPortal(path), true);
  for (const path of ["/", "/about", "/contact", "/account", "/administrator"]) assert.equal(isInternalPortal(path), false);
});
test("contact validation requires real form details and accepts an optional order reference", () => {
  assert.equal(contactSchema.safeParse(details).success, true);
  assert.equal(contactSchema.safeParse({ ...details, orderNumber: undefined }).success, true);
  for (const patch of [{ fullName: " " }, { email: "invalid" }, { subject: "x" }, { message: "short" }, { message: "x".repeat(3001) }]) assert.equal(contactSchema.safeParse({ ...details, ...patch }).success, false);
});
test("public support details expose only contact address and phone for a saved company profile", () => {
  const publicDetails = contactSchema.safeParse(details);
  assert.equal(publicDetails.success, true);
  const supplierProfile = {
    companyName: "Zera's World Suppliers",
    companyPhone: "+91 98765 43210",
    companyAddress: "12, MG Road, Bengaluru, Karnataka 560001",
    gstNumber: "29ABCDE1234F1Z5",
    companyRegistrationNumber: "U74999KA2020PTC123456",
    companyLicenseNumber: "KA-XYZ-12345",
    companyProfileNotes: "Certified supplier for kitchen and lifestyle essentials",
  };
  const result = publicSupportDetails(supplierProfile);
  assert.equal(result.phone, supplierProfile.companyPhone);
  assert.equal(result.address, supplierProfile.companyAddress);
  assert.equal(result.email, process.env.SUPPORT_EMAIL || "");
  assert.deepEqual(Object.keys(result).sort(), ["address", "email", "hours", "phone", "responseTime"].sort());
});
test("contact API saves guest messages in the admin inbox and reports failures without claiming success", async (t) => {
  const previous = prisma.auditLog; const previousSend = emailDelivery.send; let saved: unknown; let fail = false; let emailed: unknown;
  emailDelivery.send = async (message) => { emailed = message; return "email-test"; };
  Object.assign(prisma, { auditLog: { create: async (args: unknown) => { if (fail) throw Error("private database details"); saved = args; return {}; } } });
  t.after(() => { Object.assign(prisma, { auditLog: previous }); emailDelivery.send = previousSend; });
  assert.equal((await POST(request(details, "https://foreign.example"))).status, 403);
  assert.equal(saved, undefined);
  const invalid = await POST(request({ ...details, email: "invalid" })); assert.equal(invalid.status, 400); assert.equal(saved, undefined);
  const good = await POST(request(details)); assert.equal(good.status, 201);
  const response = await good.json(); assert.match(response.reference, /^CONTACT-/);
  const record = saved as unknown as { data: { action: string; details: unknown } };
  assert.equal(record.data.action, "CONTACT_REQUEST");
  assert.deepEqual(record.data.details, details);
  assert.equal((emailed as { replyTo: string }).replyTo, details.email);
  assert.equal((emailed as { to: string }).to, process.env.SUPPORT_EMAIL || "support@zerasworld.in");
  assert.equal((await POST(request({ ...details, website: "spam.example" }))).status, 200);
  assert.equal(saved, record);
  fail = true;
  const failed = await POST(request(details)); assert.equal(failed.status, 503);
  assert.equal((await failed.text()).includes("private database details"), false);
  assert.equal((await POST(request(details))).status, 503);
  assert.equal((await POST(request(details))).status, 429);
});
