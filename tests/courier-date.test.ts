import assert from "node:assert/strict";
import test from "node:test";
import { courierDate } from "../lib/courier-date";

test("Shiprocket dates normalize day-first and year-first local timestamps to India time", () => {
  for (const value of ["03 11 2026 14:30:00", "03/11/2026 14:30:00", "2026-11-03 14:30:00", "2026-11-03T14:30:00", "2026-11-03T14:30:00+05:30", "2026-11-03T09:00:00Z"]) assert.equal(courierDate(value)?.toISOString(), "2026-11-03T09:00:00.000Z");
  assert.equal(courierDate("23 05 2023 11:43:52")?.toISOString(), "2023-05-23T06:13:52.000Z");
  for (const value of ["invalid", "", null, undefined]) assert.equal(courierDate(value), null);
});
