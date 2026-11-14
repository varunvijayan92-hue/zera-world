import { test } from "node:test";
import { strict as assert } from "node:assert";
import { cjOrderRequest } from "../lib/cj-order-api";

test("creates only unpaid CJ orders and preserves sandbox flag", async () => {
  let sent: Record<string, unknown> | null = null;
  const mockFetch: typeof fetch = async (_url, init) => { sent = JSON.parse(String(init?.body)); return Response.json({ code: 200, result: true, data: { orderId: "cj1" } }); };
  const result = await cjOrderRequest("test-token", "shopping/order/createOrderV2", { payload: { payType: 3, isSandbox: 1 }, fetcher: mockFetch });
  assert.deepEqual(result, { orderId: "cj1" });
  assert.deepEqual(sent, { payType: 3, isSandbox: 1 });
  await assert.rejects(() => cjOrderRequest("test-token", "shopping/order/createOrderV2", { payload: { payType: 2 }, fetcher: mockFetch }));
});
test("treats network failures as ambiguous and does not expose request details", async () => {
  const mockFetch: typeof fetch = async () => { throw new Error("sensitive address"); };
  await assert.rejects(() => cjOrderRequest("test-token", "shopping/order/createOrderV2", { payload: { payType: 3 }, fetcher: mockFetch }), /outcome is unknown/);
});
