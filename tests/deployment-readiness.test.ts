import assert from "node:assert/strict";
import test from "node:test";
import { databaseTargetFingerprint } from "../lib/database-readiness";

test("deployment diagnostics compare database targets without exposing credentials", () => {
  const first = databaseTargetFingerprint("postgresql://user:secret-one@branch-pooler.example.test/store?schema=public");
  assert.match(first!, /^[a-f0-9]{16}$/);
  assert.equal(first, databaseTargetFingerprint("postgresql://other:secret-two@branch.example.test/store?schema=public"));
  assert.notEqual(first, databaseTargetFingerprint("postgresql://user:secret-one@branch.example.test/other?schema=public"));
  assert.notEqual(first, databaseTargetFingerprint("postgresql://user:secret-one@branch.example.test/store?schema=other"));
  assert.equal(databaseTargetFingerprint("not-a-database-url"), null);
});
