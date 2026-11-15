import test from "node:test";
import assert from "node:assert/strict";
import { authContext } from "../lib/auth";
import { whatsappConfiguration, whatsappTransport, whatsappMessageSchema, prepareWhatsAppMessage, sendWhatsAppMessage, whatsappMetadata } from "../lib/whatsapp";
import { POST } from "../app/api/admin/whatsapp/messages/route";
import { prisma } from "../lib/prisma";

const input = { submissionId: "2b1136a2-56e2-4ee8-8e48-5898673aed20", messageId: "44404", to: "+919876543210", variables: ["499.00"] };
function metadata(status = "Approved", variables = 1) {
  return { success: true, data: [{ phone_number_id: "148028678394112", verified_name: "Test sender", connection_status: "CONNECTED", templates: [{ message_id: 44404, template_name: "payment_completed", status, var_count: variables, components: [] }] }] };
}

test("WhatsApp payload normalizes Indian numbers and rejects invalid or ambiguous values", () => {
  assert.equal(whatsappMessageSchema.parse(input).to, "9876543210");
  for (const patch of [{ to: "123" }, { to: "0000000000" }, { messageId: "https://evil.test" }, { variables: ["one|two"] }, { mediaUrl: "http://example.test/a.pdf" }, { submissionId: "repeat" }]) assert.equal(whatsappMessageSchema.safeParse({ ...input, ...patch }).success, false);
});

test("pending templates and variable mismatches never reach the send endpoint", async t => {
  t.mock.method(whatsappConfiguration, "read", async () => ({ apiKey: "test-secret", phoneNumberId: "148028678394112" }));
  let status = "Pending", variables = 1;
  t.mock.method(whatsappTransport, "fetch", async (url: string, options: any) => {
    assert.ok(url.includes("dlt_manager/whatsapp"));
    assert.equal(options.headers.Authorization, "test-secret");
    assert.ok(!url.includes("test-secret"));
    return Response.json(metadata(status, variables));
  });
  await assert.rejects(prepareWhatsAppMessage(whatsappMessageSchema.parse(input)), /not approved/);
  status = "Approved"; variables = 2;
  await assert.rejects(prepareWhatsAppMessage(whatsappMessageSchema.parse(input)), /requires 2/);
  variables = 1;
  const prepared = await prepareWhatsAppMessage(whatsappMessageSchema.parse(input));
  assert.equal(prepared.message.phoneNumberId, "148028678394112");
  assert.equal(prepared.fingerprint.length, 64);
  const data = await whatsappMetadata();
  assert.equal(data.approvedTemplates, 1);
  assert.ok(!JSON.stringify(data).includes("test-secret"));
});

test("provider acceptance is reported separately from delivery, without automatic retries", async t => {
  t.mock.method(whatsappConfiguration, "read", async () => ({ apiKey: "test-secret", phoneNumberId: "148028678394112" }));
  let calls = 0;
  t.mock.method(whatsappTransport, "fetch", async (url: string) => {
    calls++;
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("numbers"), "9876543210");
    assert.equal(parsed.searchParams.get("variables_values"), "499.00");
    return Response.json({ status: true, request_id: "W-test" });
  });
  const result = await sendWhatsAppMessage({ ...whatsappMessageSchema.parse(input), phoneNumberId: "148028678394112" });
  assert.deepEqual(result, { requestId: "W-test", status: "ACCEPTED" });
  assert.equal(calls, 1);
});

test("anonymous users and managers cannot send store WhatsApp messages", async t => {
  let role: string | null = null;
  t.mock.method(authContext, "current", async () => role ? { id: "user", role, isActive: true } : null);
  const request = () => new Request("https://store.test/api/admin/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  assert.equal((await POST(request())).status, 401);
  role = "MANAGER";
  assert.equal((await POST(request())).status, 403);
});

test("a repeated submission returns its original acceptance without sending twice", async t => {
  t.mock.method(authContext, "current", async () => ({ id: "whatsapp-admin", role: "ADMIN", isActive: true }));
  t.mock.method(whatsappConfiguration, "read", async () => ({ apiKey: "test-secret", phoneNumberId: "148028678394112" }));
  let sends = 0;
  t.mock.method(whatsappTransport, "fetch", async (url: string) => {
    if (url.includes("dlt_manager")) return Response.json(metadata());
    sends++; return Response.json({ status: true, request_id: "W-once" });
  });
  let saved: any;
  const original = prisma.auditLog;
  Object.assign(prisma, { auditLog: {
    create: async ({ data }: any) => { if (saved) throw { code: "P2002" }; saved = data; return saved; },
    update: async ({ data }: any) => { saved = { ...saved, ...data }; return saved; },
    findUnique: async () => saved,
  } });
  t.after(() => Object.assign(prisma, { auditLog: original }));
  const request = (variables = input.variables) => new Request("https://store.test/api/admin/whatsapp/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, variables }) });
  assert.equal((await POST(request())).status, 202);
  const repeated = await POST(request());
  assert.equal(repeated.status, 200); assert.equal((await repeated.json()).data.requestId, "W-once");
  assert.equal((await POST(request(["different"]))).status, 409);
  assert.equal(sends, 1);
});
