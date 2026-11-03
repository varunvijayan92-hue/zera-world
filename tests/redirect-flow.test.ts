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

test("only checkout return paths are accepted for customers", () => {
 assert.equal(getPostLoginRedirectPath(false, "/checkout"), "/checkout");
 assert.equal(getPostLoginRedirectPath(false, "/checkout/payment"), "/checkout/payment");
 for (const path of ["https://evil.example", "//evil.example", "/admin", "/checkout/payment?next=evil"]) assert.equal(getPostLoginRedirectPath(false, path), "/");
 assert.equal(getPostLoginRedirectPath(true, "/checkout/payment"), "/suppliers/dashboard");
});
