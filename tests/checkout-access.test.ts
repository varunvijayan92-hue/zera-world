import assert from "node:assert/strict";
import test from "node:test";
import { authContext } from "../lib/auth";
import CheckoutLayout from "../app/checkout/layout";

test("checkout blocks visitors and non-customer roles before rendering checkout content", async t => {
  const actor = t.mock.method(authContext, "current", async () => null);
  const children = "Private checkout content";
  for (const role of [null, "ADMIN", "SUPPLIER", "MANAGER"] as const) {
    actor.mock.mockImplementation(async () => role ? { id: "u", email: "u@example.test", fullName: "User", role, isActive: true } : null);
    await assert.rejects(CheckoutLayout({ children }), (error: unknown) => {
      assert.ok(error && typeof error === "object" && "digest" in error);
      assert.match(String(error.digest), /NEXT_REDIRECT;replace;\/login\?next=%2Fcheckout;/);
      return true;
    });
  }
  actor.mock.mockImplementation(async () => ({ id: "c", email: "c@example.test", fullName: "Customer", role: "CUSTOMER", isActive: true }));
  assert.equal(await CheckoutLayout({ children }), children);
});
