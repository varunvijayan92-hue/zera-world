/* Network-only portal worker. No API, HTML, inventory or account data is stored. */
self.addEventListener("install", (event) => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || request.mode !== "navigate" || url.origin !== self.location.origin || url.pathname === "/api" || url.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request, { cache: "no-store" }).catch(() => new Response(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Zera's World | Offline</title>
<meta name="theme-color" content="#173B35"><style>body{margin:0;background:#F7F4ED;color:#173B35;font:18px/1.6 system-ui;display:grid;min-height:100vh;place-items:center}main{max-width:32rem;margin:24px;padding:32px;border-top:4px solid #B38A45}a{color:inherit;font-weight:600}</style></head>
<body><main><h1>You're offline</h1><p>Connect to the internet to continue. Current prices, stock, orders and account details require a connection.</p><p>If you were submitting a payment or order, check your orders after reconnecting before submitting again.</p><a href="">Try again</a></main></body></html>`, {
    status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'" },
  })));
});
