import assert from "node:assert/strict";
import test from "node:test";
import { supplierLocalCustomerSchema } from "../lib/supplier-local-customers";
import { POST } from "../app/api/supplier/local-customers/route";
import { authContext } from "../lib/auth";

test("local customer details require a name and a phone or valid email", () => {
  assert.equal(supplierLocalCustomerSchema.safeParse({ name: "Alice", phone: "9876543210" }).success, true);
  assert.equal(supplierLocalCustomerSchema.safeParse({ name: "Alice", email: "alice@example.com" }).success, true);
  for (const input of [{ name: "Alice" }, { name: "A", phone: "123" }, { name: "Alice", email: "bad" }, { name: "Alice", phone: "1".repeat(31) }]) assert.equal(supplierLocalCustomerSchema.safeParse(input).success, false);
});

test("local customer API rejects visitors and customers", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const request = () => new Request("https://store.example/api/supplier/local-customers", { method: "POST", headers: { origin: "https://store.example", "Content-Type": "application/json" }, body: JSON.stringify({ name: "Alice", phone: "123" }) });
  assert.equal((await POST(request())).status, 401);
  actor.mock.mockImplementation(async () => ({ id: "u", email: "u@example.test", fullName: "User", role: "CUSTOMER", isActive: true }));
  assert.equal((await POST(request())).status, 403);
});
