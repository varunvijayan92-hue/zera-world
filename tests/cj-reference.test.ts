import assert from "node:assert/strict";
import test from "node:test";
import { cjProductReference, cjProductDetails } from "../lib/cj-reference";

test("CJ product links and IDs are parsed without fetching arbitrary URLs", () => {
  assert.deepEqual(cjProductReference("https://cjdropshipping.com/product/childrens-pajamas-p-2504020615571615100.html"), { productId: "2504020615571615100" });
  assert.deepEqual(cjProductReference("2504020615571615100"), { productId: "2504020615571615100" });
  assert.deepEqual(cjProductReference("CJYE234364901AZ"), { keyword: "CJYE234364901AZ" });
  assert.equal(cjProductReference("https://cjdropshipping.com.evil.test/product/x-p-2504020615571615100.html"), null);
  assert.equal(cjProductReference("https://evil.test/product/x-p-2504020615571615100.html"), null);
  assert.equal(cjProductReference("http://cjdropshipping.com/product/x-p-2504020615571615100.html"), null);
});

test("CJ detail result exposes only public catalog fields", () => {
  assert.deepEqual(cjProductDetails({ pid: "123", productNameEn: "Product", productSku: "S", privateToken: "secret" }), { id: "123", name: "Product", sku: "S", price: "" });
  assert.equal(cjProductDetails({ pid: "123" }), null);
});
