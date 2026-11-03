import assert from "node:assert/strict";
import test from "node:test";
import { returnRefundControls } from "../lib/return-refund";

test("return controls offer gateway refunds only for verified Razorpay payments, never COD", () => {
  assert.deepEqual(returnRefundControls([{ provider: "COD", paymentStatus: "PAID", gatewayPaymentId: "COD:receipt" }]), { isCod: true, canGatewayRefund: false });
  assert.deepEqual(returnRefundControls([{ provider: "RAZORPAY", paymentStatus: "PAID", gatewayPaymentId: "pay_1" }]), { isCod: false, canGatewayRefund: true });
  for (const payment of [{ provider: "RAZORPAY", paymentStatus: "PENDING", gatewayPaymentId: "pay_1" }, { provider: "RAZORPAY", paymentStatus: "PAID", gatewayPaymentId: null }, { provider: "MANUAL", paymentStatus: "PAID", gatewayPaymentId: "manual" }]) assert.equal(returnRefundControls([payment]).canGatewayRefund, false);
});
