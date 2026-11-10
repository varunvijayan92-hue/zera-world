import test from "node:test";
import assert from "node:assert/strict";
import { authContext } from "../lib/auth";
import { POST } from "../app/api/admin/suppliers/cj-draft/route";

test("CJ draft import rejects unauthenticated, customer, and cross-origin requests", async t => {
  const current = t.mock.method(authContext, "current", async () => null);
  const request = (origin = "https://store.example") => new Request("https://store.example/api/admin/suppliers/cj-draft", { method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify({ cjProductId: "12345", supplierId: "supplier" }) });
  assert.equal((await POST(request())).status, 401);
  current.mock.mockImplementation(async () => ({ id: "customer", email: "customer@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
  assert.equal((await POST(request("https://other.example"))).status, 403);
});
