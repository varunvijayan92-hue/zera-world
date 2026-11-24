import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "../app/api/webhooks/whatsapp/route";
import { integrationStore } from "../lib/integration-settings";
import { encryptCredentials } from "../lib/integration-crypto";
import { supportInbox } from "../lib/support-inbox";

test("WhatsApp inbox verifies signatures and only stores inbound messages for the configured sender", async t => {
  const previousKey = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
  t.after(() => {
    if (previousKey === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY;
    else process.env.INTEGRATION_ENCRYPTION_KEY = previousKey;
  });
  const appSecret = "test-secret";
  const encryptedCredentials = encryptCredentials({ appSecret, wabaId: "test-waba", phoneNumberId: "test-phone" });
  t.mock.method(integrationStore, "find", async () => ({ encryptedCredentials }));
  const receive = t.mock.method(supportInbox, "receive", async () => {});
  const payload = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "test-waba", changes: [
    { field: "messages", value: { metadata: { phone_number_id: "test-phone" }, messages: [
      { id: "wamid.1", from: "919876543210", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Order help" } },
    ] } },
    { field: "messages", value: { metadata: { phone_number_id: "other-phone" }, messages: [
      { id: "wamid.2", from: "919876543210", timestamp: String(Math.floor(Date.now() / 1000)), type: "text", text: { body: "Other sender" } },
    ] } },
  ] }] });
  const signature = createHmac("sha256", appSecret).update(payload).digest("hex");
  const request = (value: string) => new Request("https://store.test/api/webhooks/whatsapp", {
    method: "POST", headers: { "x-hub-signature-256": `sha256=${value}` }, body: payload,
  });
  assert.equal((await POST(request("0".repeat(64)))).status, 403);
  assert.equal(receive.mock.callCount(), 0);
  assert.equal((await POST(request(signature))).status, 200);
  assert.equal(receive.mock.callCount(), 1);
  const [messages] = receive.mock.calls[0].arguments as unknown as [Array<{ body: string; id: string }>];
  assert.equal(messages.length, 1);
  assert.equal(messages[0].id, "whatsapp:wamid.1");
  assert.equal(messages[0].body, "Order help");
});
