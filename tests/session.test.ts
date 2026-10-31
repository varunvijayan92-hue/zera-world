import assert from "node:assert/strict";
import test from "node:test";
import { signSession, verifySessionToken } from "../lib/session";
import { POST as disabledWebhookTest } from "../app/api/payments/webhook/test/route";

test("session signatures reject tampering and weak configuration", async () => {
  const original = process.env.JWT_SECRET;
  try {
    process.env.JWT_SECRET = "test-only-secret-with-at-least-32-characters";
    const token = await signSession({ userId: "u1", email: "admin@example.com", role: "ADMIN", fullName: "Admin" });
    assert.equal((await verifySessionToken(token))?.userId, "u1");
    const [, signature] = token.split(".");
    const alteredPayload = Buffer.from(JSON.stringify({ userId: "intruder", role: "ADMIN" })).toString("base64url");
    assert.equal(await verifySessionToken(`${alteredPayload}.${signature}`), null);
    process.env.JWT_SECRET = "short";
    await assert.rejects(() => signSession({ userId: "u1", email: "a@b.com", role: "ADMIN", fullName: "Admin" }));
    assert.equal(await verifySessionToken(token), null);
  } finally {
    if (original === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = original;
  }
});

test("disabled webhook test endpoint never discloses the configured secret", async () => {
  const original = process.env.RAZORPAY_WEBHOOK_SECRET;
  try {
    process.env.RAZORPAY_WEBHOOK_SECRET = "sensitive-test-secret";
    const response = await disabledWebhookTest();
    assert.equal(response.status, 404);
    assert.equal((await response.text()).includes("sensitive-test-secret"), false);
  } finally {
    if (original === undefined) delete process.env.RAZORPAY_WEBHOOK_SECRET;
    else process.env.RAZORPAY_WEBHOOK_SECRET = original;
  }
});
