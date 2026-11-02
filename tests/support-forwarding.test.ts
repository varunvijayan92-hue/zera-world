import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { Resend } from "resend";
import { supportMailClient } from "../lib/support-mail";
import { POST } from "../app/api/webhooks/resend/route";

test("incoming support email forwarding verifies signatures, preserves replies and blocks loops", async t => {
  const apiKey = process.env.RESEND_API_KEY, secret = process.env.RESEND_WEBHOOK_SECRET;
  const client = supportMailClient.create;
  const bytes = Buffer.from("unit-test-support-forwarding-secret");
  process.env.RESEND_API_KEY = "re_unit_test";
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${bytes.toString("base64")}`;
  const verifier = new Resend("re_unit_test");
  let marker = false, fail = false, oversized = false, sends = 0; let sent: Record<string, unknown> = {}; let key = "";
  supportMailClient.create = () => ({
    webhooks: verifier.webhooks,
    emails: {
      receiving: { get: async () => fail ? { error: { message: "private provider details" } } : { data: { from: "supportzerasworld@gmail.com", to: ["support@zerasworld.in"], reply_to: ["customer@example.test"], subject: "Order help", text: "Please help with my order", html: "<p>Please help with my order</p>", headers: marker ? { "X-Zera-Support-Forwarded": "1" } : {} } }, attachments: { list: async () => ({ data: { data: oversized ? [{ size: 11 * 1024 * 1024, filename: "large.bin", download_url: "https://example.test/large" }] : [] } }) } },
      send: async (message: Record<string, unknown>, options: { idempotencyKey: string }) => { sends++; sent = message; key = options.idempotencyKey; return { data: { id: "forwarded-test" }, error: null }; },
    },
  } as unknown as Resend);
  t.after(() => { supportMailClient.create = client; if (apiKey === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = apiKey; if (secret === undefined) delete process.env.RESEND_WEBHOOK_SECRET; else process.env.RESEND_WEBHOOK_SECRET = secret; });
  const request = (to = "support@zerasworld.in", valid = true) => {
    const payload = JSON.stringify({ type: "email.received", created_at: new Date().toISOString(), data: { email_id: "incoming-test", from: "supportzerasworld@gmail.com", to: [to] } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", bytes).update(`msg-test.${timestamp}.${payload}`).digest("base64");
    return new Request("https://zerasworld.in/api/webhooks/resend", { method: "POST", headers: { "svix-id": "msg-test", "svix-timestamp": timestamp, "svix-signature": valid ? `v1,${signature}` : "v1,invalid" }, body: payload });
  };
  assert.equal((await POST(request(undefined, false))).status, 400); assert.equal(sends, 0);
  assert.equal((await POST(request("other@zerasworld.in"))).status, 200); assert.equal(sends, 0);
  const success = await POST(request()); assert.equal(success.status, 200); assert.equal((await success.json()).forwarded, true);
  assert.deepEqual(sent.to, ["supportzerasworld@gmail.com"]);
  assert.equal(sent.replyTo, "customer@example.test");
  assert.equal(sent.html, "<p>Please help with my order</p>");
  assert.deepEqual(sent.headers, { "X-Zera-Support-Forwarded": "1" });
  assert.equal(key, "support-forward/incoming-test");
  marker = true; assert.equal((await POST(request())).status, 200); assert.equal(sends, 1);
  marker = false; oversized = true; assert.equal((await POST(request())).status, 200); assert.match(String(sent.text), /Attachments exceed 10 MB/); assert.deepEqual(sent.attachments, []); oversized = false; fail = true; const failed = await POST(request()); assert.equal(failed.status, 500); assert.doesNotMatch(await failed.text(), /private provider/);
});
