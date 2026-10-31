import assert from "node:assert/strict";
import test from "node:test";
import { openRazorpay, type RazorpayResponse } from "../lib/razorpay-browser";

const options = {
  key: "rzp_test_unit", amount: 100, currency: "INR", order_id: "order_test1",
  name: "Test Store", description: "Test", prefill: { name: "Test", email: "test@example.com", contact: "9999999999" },
  theme: { color: "#173B35" },
};

test("checkout modal returns all signature fields and reports cancellation/failure", async (t) => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });
  for (const outcome of ["success", "cancel", "failure"]) {
    let modalOptions: { handler(response: RazorpayResponse): void; modal: { ondismiss(): void } };
    let fail: (response: { error: { description: string } }) => void;
    let closed = false;
    class FakeCheckout {
      constructor(input: typeof modalOptions) { modalOptions = input; }
      on(_event: string, callback: typeof fail) { fail = callback; }
      close() { closed = true; modalOptions.modal.ondismiss(); }
      open() {
        if (outcome === "success") modalOptions.handler({ razorpay_order_id: "order_test1", razorpay_payment_id: "pay_test1", razorpay_signature: "signed" });
        if (outcome === "cancel") modalOptions.modal.ondismiss();
        if (outcome === "failure") fail({ error: { description: "Test payment declined" } });
      }
    }
    Object.defineProperty(globalThis, "window", { configurable: true, value: { Razorpay: FakeCheckout } });
    if (outcome === "success") {
      assert.deepEqual(await openRazorpay(options), { razorpay_order_id: "order_test1", razorpay_payment_id: "pay_test1", razorpay_signature: "signed" });
    } else {
      await assert.rejects(() => openRazorpay(options), outcome === "cancel" ? /cancelled/ : /declined/);
    }
    assert.equal(closed, outcome === "failure");
  }
});
