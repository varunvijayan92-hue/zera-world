import assert from "node:assert/strict";
import test from "node:test";
import { cheapestApprovedCjMethod, cjOrderPolicySchema } from "../lib/cj-order-policy";
import { authContext, AUTH_COOKIE } from "../lib/auth";
import { POST } from "../app/api/admin/suppliers/cj-order-policy/route";

test("CJ shipping settings require a country and unique bounded exact method names", () => {
  assert.equal(cjOrderPolicySchema.parse({ origin: "cn", trackedMethods: [] }).origin, "CN");
  assert.equal(cjOrderPolicySchema.safeParse({ origin: "", trackedMethods: [] }).success, false);
  assert.equal(cjOrderPolicySchema.safeParse({ origin: "CN", trackedMethods: ["DHL", "DHL"] }).success, false);
});
test("only explicitly approved methods can be considered, choosing the cheapest", () => {
  const quotes = [{ name: "Unconfirmed", usd: 1 }, { name: "Approved A", usd: 12 }, { name: "Approved B", usd: 8 }];
  assert.equal(cheapestApprovedCjMethod(quotes, ["Approved A", "Approved B"])?.name, "Approved B");
  assert.equal(cheapestApprovedCjMethod(quotes, []), null);
  assert.equal(cheapestApprovedCjMethod(quotes, ["approved b"]), null);
});

test("only same-origin administrators may change CJ order settings", async t => {
  const request = (origin: string) => new Request("https://store.example/api/admin/suppliers/cj-order-policy", { method: "POST", headers: { origin, cookie: `${AUTH_COOKIE}=test`, "content-type": "application/json" }, body: JSON.stringify({ origin: "CN", trackedMethods: [] }) });
  const actor = t.mock.method(authContext, "current", async () => ({ id: "u", role: "CUSTOMER", isActive: true, email: "u@example.test", fullName: "User" }));
  assert.equal((await POST(request("https://store.example"))).status, 403);
  actor.mock.mockImplementation(async () => ({ id: "a", role: "ADMIN", isActive: true, email: "a@example.test", fullName: "Admin" }));
  assert.equal((await POST(request("https://other.example"))).status, 403);
});
