import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWhatsAppTestRecipient, renderWhatsAppPreview, whatsappTestVariables } from "../lib/whatsapp-preview";
import { parseWhatsAppTemplate } from "../lib/whatsapp";

test("test recipients accept formatted Indian numbers without changing the destination", () => {
  for (const input of ["9876543210", "+91 98765 43210", "91-98765-43210", "(+91) 9876543210"]) assert.equal(normalizeWhatsAppTestRecipient(input), "9876543210");
  for (const input of ["", "123", "+1 9876543210", "0000000000", "98765432101"]) assert.equal(normalizeWhatsAppTestRecipient(input), null);
});

test("previews substitute repeated numbered variables and preserve missing placeholders", () => {
  assert.equal(renderWhatsAppPreview("Hi {{1}}; order {{ 2 }} for {{1}}; {{3}}", ["Customer", "TEST-1001"]), "Hi Customer; order TEST-1001 for Customer; {{3}}");
});

test("every supplied workflow test is explicitly marked as a demo", () => {
  for (const name of ["payment_completed", "zera_order_placed_v1", "zera_order_shipped_v1", "zera_order_delivered_v1"]) {
    const variables = whatsappTestVariables(name, 1);
    assert.match(variables[0], /TEST ONLY/);
    assert.ok(!variables[0].includes("|"));
  }
});

test("template metadata exposes provider text and examples for an accurate preview", () => {
  const template = parseWhatsAppTemplate({ id: "1", name: "order", language: "en_US", status: "PENDING",
    components: [{ type: "BODY", text: "Order {{1}}", example: { body_text: [["TEST-1001"]] } }] });
  assert.equal(template.body, "Order {{1}}");
  assert.deepEqual(template.examples, ["TEST-1001"]);
});
