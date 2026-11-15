import assert from "node:assert/strict";
import test from "node:test";
import {
  registerDeviceToken,
  unregisterDeviceToken,
  getRegisteredDevices,
  dispatchAlert,
  getRecentAlertLogs,
} from "../lib/notifications";

test("device token registration and unregistration works for admin and supplier", () => {
  const adminToken = "fcm_token_admin_test_123";
  const supplierToken = "fcm_token_supplier_test_456";

  registerDeviceToken({
    fcmToken: adminToken,
    userId: "user_admin_1",
    role: "ADMIN",
    platform: "ANDROID",
    deviceModel: "Pixel 8",
    updatedAt: new Date().toISOString(),
  });

  registerDeviceToken({
    fcmToken: supplierToken,
    userId: "user_supplier_1",
    role: "SUPPLIER",
    supplierId: "supp_101",
    platform: "ANDROID",
    deviceModel: "Samsung S24",
    updatedAt: new Date().toISOString(),
  });

  const all = getRegisteredDevices();
  assert.ok(all.some((d) => d.fcmToken === adminToken));
  assert.ok(all.some((d) => d.fcmToken === supplierToken));

  const adminOnly = getRegisteredDevices({ role: "ADMIN" });
  assert.ok(adminOnly.every((d) => d.role === "ADMIN"));

  const suppOnly = getRegisteredDevices({ role: "SUPPLIER", supplierId: "supp_101" });
  assert.ok(suppOnly.some((d) => d.supplierId === "supp_101"));

  const deleted = unregisterDeviceToken(adminToken);
  assert.equal(deleted, true);
  assert.equal(getRegisteredDevices().some((d) => d.fcmToken === adminToken), false);
});

test("dispatchAlert stores and scopes ORDER_ALERT, RETURN_ALERT, and PAYMENT_ALERT", async () => {
  const token = "fcm_token_test_recipient";
  registerDeviceToken({
    fcmToken: token,
    userId: "user_admin_2",
    role: "ADMIN",
    platform: "ANDROID",
    deviceModel: "Pixel 9",
    updatedAt: new Date().toISOString(),
  });

  // 1. Order alert
  const orderRes = await dispatchAlert({
    type: "ORDER_ALERT",
    title: "🚨 New Order #ZW-100",
    body: "Order for ₹1,999 placed",
    data: { orderId: "ord_100", amount: "1999", alertType: "ORDER_ALERT" },
    targetRole: "ALL",
  });
  assert.equal(orderRes.success, true);
  assert.ok(orderRes.recipientCount >= 1);
  assert.equal(orderRes.alert.type, "ORDER_ALERT");

  // 2. Return alert
  const returnRes = await dispatchAlert({
    type: "RETURN_ALERT",
    title: "📦 New Return Request!",
    body: "Customer requested return for Order #ZW-100",
    data: { returnId: "ret_200", orderId: "ord_100", alertType: "RETURN_ALERT" },
    targetRole: "ADMIN",
  });
  assert.equal(returnRes.success, true);
  assert.equal(returnRes.alert.type, "RETURN_ALERT");

  // 3. Payment alert
  const paymentRes = await dispatchAlert({
    type: "PAYMENT_ALERT",
    title: "💰 Payment Received!",
    body: "Payment of ₹1,999 captured via Razorpay",
    data: { paymentId: "pay_300", amount: "1999", alertType: "PAYMENT_ALERT" },
    targetRole: "ALL",
  });
  assert.equal(paymentRes.success, true);
  assert.equal(paymentRes.alert.type, "PAYMENT_ALERT");

  // Verify recent alert logs
  const logs = getRecentAlertLogs();
  assert.ok(logs.some((l) => l.type === "ORDER_ALERT"));
  assert.ok(logs.some((l) => l.type === "RETURN_ALERT"));
  assert.ok(logs.some((l) => l.type === "PAYMENT_ALERT"));
});
