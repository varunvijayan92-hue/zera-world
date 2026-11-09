import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/admin/integrations/cj/route";
import { authContext } from "../lib/auth";
import { integrationStore } from "../lib/integration-settings";
import { encryptCredentials } from "../lib/integration-crypto";

test("CJ connection is admin-only, checks the fixed endpoint and never returns credentials", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = () => new Request("https://store.example/api/admin/integrations/cj", { method: "POST", headers: { origin: "https://store.example" } });
  assert.equal((await POST(request())).status, 401);
  for (const role of ["CUSTOMER", "SUPPLIER", "MANAGER"] as const) {
    actor.mock.mockImplementation(async () => ({ id: "user", email: "user@example.test", fullName: "User", role, isActive: true }));
    assert.equal((await POST(request())).status, 403);
  }
  actor.mock.mockImplementation(async () => ({ id: "admin", email: "admin@example.test", fullName: "Admin", role: "ADMIN", isActive: true }));
  const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
  t.after(() => { if (previous === undefined) delete process.env.INTEGRATION_ENCRYPTION_KEY; else process.env.INTEGRATION_ENCRYPTION_KEY = previous; });
  t.mock.method(integrationStore, "find", async () => ({ id: "test", provider: "CJ_DROPSHIPPING", encryptedCredentials: encryptCredentials({ apiKey: "private-test-key" }), options: null, updatedAt: new Date() }));
  const fetchMock = t.mock.method(globalThis, "fetch", async (input, init) => {
    assert.equal(String(input), "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken");
    assert.equal(init?.redirect, "error");
    assert.equal(JSON.parse(String(init?.body)).apiKey, "private-test-key");
    return Response.json({ code: 200, result: true, data: { accessToken: "private-test-token" } });
  });
  const response = await POST(request()); assert.equal(response.status, 200);
  const payload = await response.text(); assert.doesNotMatch(payload, /private-test-(key|token)/); assert.match(payload, /not yet implemented/);
  fetchMock.mock.mockImplementation(async () => Response.json({ code: 1601000, result: false, message: "private-test-key" }));
  const failed = await POST(request()); assert.equal(failed.status, 400); assert.doesNotMatch(await failed.text(), /private-test-key/);
});
