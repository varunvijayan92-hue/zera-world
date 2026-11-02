import assert from "node:assert/strict";
import test from "node:test";
import robots from "../app/robots";
import { buildStoreSitemap, publicPageMetadata, publicPagePaths, SITE_URL, storeStructuredData } from "../lib/seo";
import type { MenuCategory } from "../lib/category";

test("sitemap contains public pages, visible category trees and published products on the canonical domain", () => {
  const updatedAt = new Date("2026-10-31T12:00:00Z");
  const root: MenuCategory = { id: "root", name: "Kitchen", slug: "kitchen", description: "", isVisible: true, sortOrder: 0, parentId: null };
  const entries = buildStoreSitemap([root, { ...root, id: "child", slug: "storage", parentId: root.id }, { ...root, id: "hidden", slug: "hidden", isVisible: false }, { ...root, id: "hidden-child", slug: "hidden-child", parentId: "hidden" }], [{ id: "published", status: "ACTIVE", updatedAt, imageUrls: ["https://res.cloudinary.com/example/photo.png"] }, { id: "draft", status: "DRAFT", updatedAt, imageUrls: [] }, { id: "old", status: "ARCHIVED", updatedAt, imageUrls: [] }]);
  const urls = entries.map(entry => entry.url);
  assert.equal(urls.length, publicPagePaths.length + 3);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.every(url => new URL(url).origin === SITE_URL));
  assert.ok(urls.includes(`${SITE_URL}/products?category=storage`));
  assert.ok(urls.includes(`${SITE_URL}/products/published`));
  assert.equal(urls.some(url => /hidden|draft|\/old$|admin|checkout|login|account|api\//.test(url)), false);
  assert.equal(entries.find(entry => entry.url.endsWith("/published"))?.lastModified, updatedAt);
});
test("robots advertises the live sitemap and excludes private portal and checkout routes", () => {
  const config = robots();
  assert.equal(config.sitemap, `${SITE_URL}/sitemap.xml`);
  assert.equal(Array.isArray(config.rules), false);
  const rule = config.rules as { allow: string; disallow: string[] };
  assert.equal(rule.allow, "/");
  for (const path of ["/admin", "/suppliers", "/account", "/checkout", "/login", "/api/"]) assert.ok(rule.disallow.includes(path));
});
test("brand aliases are legitimate structured names and public page canonicals remain distinct", () => {
  const website = storeStructuredData["@graph"][0];
  assert.equal(website.name, "Zera's World");
  assert.deepEqual(website.alternateName, ["ZerasWorld", "Zeras World"]);
  assert.equal(publicPageMetadata("About", "About the store", "/about").alternates?.canonical, `${SITE_URL}/about`);
  assert.equal(publicPageMetadata("Contact", "Contact the store", "/contact").alternates?.canonical, `${SITE_URL}/contact`);
});
