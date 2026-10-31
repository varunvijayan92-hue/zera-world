import assert from "node:assert/strict";
import test from "node:test";
import { adminNavigation, isAdminNavActive, adminLandingPath } from "../lib/admin-navigation";
import { stockUpdateSchema, expenseSchema, userCreateSchema, userAccessError, publicUserSelect } from "../lib/admin-operations";
import { groupCheckoutCustomers, contactFromAddress, adminDate } from "../lib/admin-format";
import { isSameOriginRequest } from "../lib/request-origin";

test("admin entry uses its own login for visitors and customer accounts", () => {
  for (const role of [undefined, null, "CUSTOMER", "SUPPLIER", "STAFF", "UNKNOWN"]) assert.equal(adminLandingPath(role), "/admin/login");
  for (const role of ["ADMIN", "MANAGER"]) assert.equal(adminLandingPath(role), "/admin/dashboard");
});

test("admin mutations accept their own origin and reject cross-origin submissions", () => {
  assert.equal(isSameOriginRequest(new Request("https://store.example/api/admin/users", { headers: { origin: "https://store.example" } })), true);
  assert.equal(isSameOriginRequest(new Request("https://store.example/api/admin/users")), true);
  assert.equal(isSameOriginRequest(new Request("https://store.example/api/admin/users", { headers: { origin: "https://other.example" } })), false);
});

test("the admin navigation includes all requested sections without ambiguous active matches", () => {
  const items = adminNavigation.flatMap((group) => [...group.items]);
  assert.equal(items.length, 19);
  assert.equal(new Set(items.map((item) => item.href)).size, 19);
  assert.equal(isAdminNavActive("/admin/invoices/order1", "/admin/invoices"), true);
  assert.equal(isAdminNavActive("/admin/product-sync", "/admin/products"), false);
});

test("stock adjustments validate reservation limits, integers and a concurrency version", () => {
  const row = { availableQty: 10, reservedQty: 2, damagedQty: 0, safetyStock: 1, updatedAt: new Date().toISOString() };
  assert.equal(stockUpdateSchema.safeParse(row).success, true);
  assert.equal(stockUpdateSchema.safeParse({ ...row, reservedQty: 11 }).success, false);
  assert.equal(stockUpdateSchema.safeParse({ ...row, availableQty: -1 }).success, false);
  assert.equal(stockUpdateSchema.safeParse({ ...row, damagedQty: 0.5 }).success, false);
  assert.equal(stockUpdateSchema.safeParse({ ...row, updatedAt: "" }).success, false);
});

test("expense entries require a positive finite amount and a valid date", () => {
  const expense = { category: "Shipping", amount: 99, expenseDate: new Date().toISOString() };
  assert.equal(expenseSchema.safeParse(expense).success, true);
  assert.equal(expenseSchema.safeParse({ ...expense, amount: 0 }).success, false);
  assert.equal(expenseSchema.safeParse({ ...expense, amount: Infinity }).success, false);
  assert.equal(expenseSchema.safeParse({ ...expense, expenseDate: "yesterday" }).success, false);
});

test("staff creation normalizes email and prevents bcrypt password truncation", () => {
  const user = { fullName: "Store Staff", email: "STAFF@EXAMPLE.COM", password: "a-strong-test-password", role: "STAFF" };
  assert.equal(userCreateSchema.parse(user).email, "staff@example.com");
  assert.equal(userCreateSchema.safeParse({ ...user, password: "short" }).success, false);
  assert.equal(userCreateSchema.safeParse({ ...user, password: "😀".repeat(30) }).success, false);
  assert.equal("passwordHash" in publicUserSelect, false);
  assert.equal("password" in publicUserSelect, false);
});

test("access changes protect the acting account and the final active administrator", () => {
  const user = { id: "admin1", role: "ADMIN", isActive: true };
  assert.ok(userAccessError("admin1", user, { role: "STAFF", isActive: true }, 2));
  assert.ok(userAccessError("admin1", user, { role: "ADMIN", isActive: false }, 2));
  assert.ok(userAccessError("other", user, { role: "STAFF", isActive: true }, 1));
  assert.equal(userAccessError("other", user, { role: "STAFF", isActive: true }, 2), null);
});

test("checkout contacts group by reliable identifiers, preserve latest details and do not merge namesakes", () => {
  const old = new Date("2026-10-01T00:00:00Z"); const recent = new Date("2026-10-20T00:00:00Z");
  const orders = [
    { id: "a", customerName: "Same Name", shippingAddress: { fullName: "Latest Name", email: "TEST@EXAMPLE.COM", phone: "new" }, createdAt: recent, totalAmount: 100 },
    { id: "b", customerName: "Same Name", shippingAddress: { email: "test@example.com", phone: "old" }, createdAt: old, totalAmount: 200 },
    { id: "c", customerName: "Same Name", shippingAddress: null, createdAt: old, totalAmount: 10 },
    { id: "d", customerName: "Same Name", shippingAddress: null, createdAt: old, totalAmount: 20 },
  ];
  const customers = groupCheckoutCustomers(orders);
  assert.equal(customers.length, 3);
  assert.equal(customers[0].name, "Latest Name");
  assert.equal(customers[0].phone, "new");
  assert.equal(customers[0].orderCount, 2);
  assert.equal(customers[0].orderValue, 300);
  assert.equal(contactFromAddress(["malformed"]).email, "");
  assert.match(adminDate(new Date("2026-10-30T20:00:00Z")), /31/);
});
