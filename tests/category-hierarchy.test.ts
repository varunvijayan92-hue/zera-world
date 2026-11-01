import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../lib/prisma";
import { categorySchema, categoryParentError, categoryProductIds, visibleMenuCategories, categoryDisplayName, type MenuCategory } from "../lib/category";
import { saveMenuCategory, deleteMenuCategory } from "../lib/category-data";
const root: MenuCategory = { id: "root", name: "Kitchen", slug: "kitchen", description: "", sortOrder: 0, isVisible: true, parentId: null };
const child: MenuCategory = { ...root, id: "child", name: "Storage", slug: "storage", parentId: "root" };
test("category hierarchy accepts roots and children and rejects cycles, missing parents and extra levels", () => {
  const rows = [root, child];
  assert.equal(categorySchema.safeParse({ name: "Storage", slug: "storage", parentId: root.id }).success, true);
  assert.equal(categorySchema.safeParse({ name: "Storage", slug: "storage", parentId: "" }).success, false);
  assert.equal(categoryParentError(rows, "child", "root"), null);
  assert.ok(categoryParentError(rows, "root", "root"));
  assert.ok(categoryParentError(rows, "new", "missing"));
  assert.ok(categoryParentError(rows, "new", "child"));
  assert.ok(categoryParentError([...rows, { ...root, id: "other" }], "root", "other"));
});
test("parent filters include child products, subcategory filters stay specific, and hidden parents hide child menus", () => {
  const rows = [root, child, { ...child, id: "hidden", isVisible: false }];
  assert.deepEqual(categoryProductIds(root, rows), ["root", "child", "hidden"]);
  assert.deepEqual(categoryProductIds(child, rows), ["child"]);
  assert.equal(categoryDisplayName(child, rows), "Kitchen / Storage");
  assert.deepEqual(visibleMenuCategories(rows).map(row => row.id), ["root", "child"]);
  assert.equal(visibleMenuCategories([{ ...root, isVisible: false }, child]).length, 0);
});
test("category mutations validate parents inside the transaction and preserve parent assignment on partial edits", async t => {
  const original = prisma.$transaction;
  let writes = 0; let parent: unknown;
  const tx = { $queryRaw: async () => [root, child], storeCategory: { update: async ({ data }: { data: object }) => { writes++; return { ...child, ...data }; }, create: async ({ data }: { data: object }) => { writes++; return { id: "new", ...data }; } }, $executeRaw: async (_: unknown, ...values: unknown[]) => { parent = values[0]; return 1; }, product: { updateMany: async () => ({ count: 0 }) } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  await assert.rejects(saveMenuCategory({ parentId: "child", name: "Invalid", slug: "invalid" }), /main category/);
  assert.equal(writes, 0);
  const result = await saveMenuCategory({ description: "Updated" }, "child");
  assert.equal(result.parentId, "root"); assert.equal(parent, "root");
});
test("deleting parents with subcategories or categories with products is blocked", async t => {
  const original = prisma.$transaction; let children = true; let products = 0; let deletes = 0;
  const tx = { $queryRaw: async (sql: TemplateStringsArray) => sql.join("").includes('SELECT *') ? [root] : children ? [{ id: "child" }] : [], product: { count: async () => products }, storeCategory: { delete: async () => { deletes++; } } };
  Object.assign(prisma, { $transaction: async (work: (client: typeof tx) => unknown) => work(tx) });
  t.after(() => Object.assign(prisma, { $transaction: original }));
  await assert.rejects(deleteMenuCategory("root"), /subcategories/);
  children = false; products = 1; await assert.rejects(deleteMenuCategory("root"), /products/);
  products = 0; await deleteMenuCategory("root"); assert.equal(deletes, 1);
});
