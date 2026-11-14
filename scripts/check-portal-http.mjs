import assert from "node:assert/strict";

// Read-only deployment smoke check. Never signs in or creates business records.
const base = process.argv[2] || "http://127.0.0.1:3000";
for (const [path, id] of [["/manifest.webmanifest", "/"], ["/admin/manifest.webmanifest", "/admin/"], ["/suppliers/manifest.webmanifest", "/suppliers/"]]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200, `${path} must be available before login`);
  assert.match(response.headers.get("content-type") || "", /application\/manifest\+json/);
  assert.equal((await response.json()).id, id);
  console.log(`${path}: correct app identity`);
}
for (const [path, manifest] of [["/admin/login", "/admin/manifest.webmanifest"], ["/suppliers/login", "/suppliers/manifest.webmanifest"]]) {
  const response = await fetch(new URL(path, base));
  assert.equal(response.status, 200);
  const html = await response.text();
  const links = html.match(/<link[^>]*rel="manifest"[^>]*>/g) || [];
  assert.equal(links.length, 1, `${path} must link exactly one manifest`);
  assert.ok(links[0].includes(`href="${manifest}"`), `${path} must select its own manifest`);
  assert.match(response.headers.get("cache-control") || "", /no-store/);
  console.log(`${path}: correct manifest link and no-store`);
}
const worker = await fetch(new URL("/sw.js", base));
assert.equal(worker.status, 200);
assert.match(worker.headers.get("cache-control") || "", /no-store/);
assert.match(await worker.text(), /You're offline/);
console.log("/sw.js: served with no-store");
const denied = await fetch(new URL("/api/mobile/navigation", base));
assert.equal(denied.status, 401);
assert.match(denied.headers.get("cache-control") || "", /no-store/);
console.log("/api/mobile/navigation: unsigned request rejected with no-store");
