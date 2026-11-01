import assert from "node:assert/strict";
import test from "node:test";

import { getPostLoginRedirectPath, getPostPaymentRedirectPath } from "../lib/navigation-paths";

test("customers are sent home after a successful login", () => {
  assert.equal(getPostLoginRedirectPath(false), "/");
});

test("suppliers still go to the supplier dashboard after login", () => {
  assert.equal(getPostLoginRedirectPath(true), "/suppliers/dashboard");
});

test("successful payments send customers to their order history", () => {
  assert.equal(getPostPaymentRedirectPath(), "/account");
});
