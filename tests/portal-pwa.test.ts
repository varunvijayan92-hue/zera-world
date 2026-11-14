import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { portalManifest } from "../lib/portal-manifest";
import { GET as customerManifest } from "../app/manifest.webmanifest/route";
import { GET as adminManifest } from "../app/admin/manifest.webmanifest/route";
import { GET as supplierManifest } from "../app/suppliers/manifest.webmanifest/route";

test("private portal manifest endpoints return installable manifest JSON", async () => {
  for (const [handler, id] of [[customerManifest, "/"], [adminManifest, "/admin/"], [supplierManifest, "/suppliers/"]] as const) {
    const response = handler();
    assert.equal(response.headers.get("content-type"), "application/manifest+json");
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).id, id);
  }
});

test("portals have distinct install identities and launch within their own scope", () => {
  const manifests = (["customer", "admin", "supplier"] as const).map(portalManifest);
  assert.equal(new Set(manifests.map(m => m.id)).size, 3);
  assert.deepEqual(manifests.map(m => m.scope), ["/", "/admin/", "/suppliers/"]);
  for (const manifest of manifests) {
    assert.ok(manifest.start_url!.startsWith(manifest.scope!));
    assert.equal(manifest.theme_color, "#173B35");
    assert.equal(manifest.background_color, "#F7F4ED");
    assert.equal(manifest.display, "standalone");
  }
});

function worker(network: typeof fetch) {
  const handlers = new Map<string, (event: any) => void>();
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { location: { origin: "https://shop.test" }, addEventListener: (name: string, handler: (event: any) => void) => handlers.set(name, handler) },
    URL, Response, fetch: network,
    // Any accidental access to persistent caching fails this test.
    get caches() { throw new Error("Sensitive portal content must not be cached"); },
  });
  return handlers.get("fetch")!;
}

test("offline navigation shows a generic fallback without private or live data", async () => {
  const handler = worker(async () => { throw new Error("offline"); });
  let response: Promise<Response> | undefined;
  handler({ request: { method: "GET", mode: "navigate", url: "https://shop.test/admin/orders?private=secret" }, respondWith: (value: Promise<Response>) => { response = value; } });
  const result = await response!;
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("cache-control"), "no-store");
  const html = await result.text();
  assert.match(html, /You're offline/);
  assert.equal(html.includes("secret"), false);
  assert.match(html, /check your orders/);
});

test("API calls, mutations and cross-origin requests are never intercepted or queued", () => {
  let intercepted = 0;
  const handler = worker(async () => { throw new Error("must not fetch"); });
  for (const request of [
    { method: "POST", mode: "navigate", url: "https://shop.test/api/payments/checkout" },
    { method: "GET", mode: "cors", url: "https://shop.test/api/account" },
    { method: "GET", mode: "navigate", url: "https://shop.test/api/account" },
    { method: "GET", mode: "cors", url: "https://shop.test/products?_rsc=123" },
    { method: "GET", mode: "navigate", url: "https://other.test/" },
  ]) handler({ request, respondWith: () => { intercepted++; } });
  assert.equal(intercepted, 0);
});

test("online navigations use no-store and retain server errors rather than showing cached data", async () => {
  let cache: unknown;
  const handler = worker(async (_request, options) => { cache = options?.cache; return new Response("Server unavailable", { status: 503 }); });
  let response: Promise<Response> | undefined;
  handler({ request: { method: "GET", mode: "navigate", url: "https://shop.test/account" }, respondWith: (value: Promise<Response>) => { response = value; } });
  const result = await response!;
  assert.equal(cache, "no-store");
  assert.equal(await result.text(), "Server unavailable");
});
