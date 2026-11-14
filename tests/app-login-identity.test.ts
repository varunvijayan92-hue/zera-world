import { test } from "node:test";
import { strict as assert } from "node:assert";
import { loginIdentityWhere } from "../lib/login-identity";

test("shared app login only searches permitted portal roles", () => {
  const where = loginIdentityWhere("Supplier123", "APP");
  assert.deepEqual(where.role, { in: ["ADMIN", "MANAGER", "SUPPLIER"] });
  assert.ok(Array.isArray(where.OR));
  assert.ok(where.OR.some((entry) => entry.loginId === "supplier123"));
});
