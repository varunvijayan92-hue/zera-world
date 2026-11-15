export interface RegisteredDevice {
  userId: string;
  role: string; // "ADMIN", "MANAGER", "SUPPLIER"
  supplierId?: string | null;
  fcmToken: string;
  platform: string;
  deviceModel: string;
  updatedAt: string;
}

export interface AlertData {
  alertType?: string;
  type?: string;
  title?: string;
  body?: string;
  orderId?: string;
  marketplaceOrderId?: string;
  returnId?: string;
  paymentId?: string;
  amount?: string;
  [key: string]: string | undefined;
}

export interface AlertPayload {
  type: "ORDER_ALERT" | "RETURN_ALERT" | "PAYMENT_ALERT" | "GENERAL";
  title: string;
  body: string;
  data?: AlertData;
  targetRole?: "ADMIN" | "SUPPLIER" | "ALL";
  targetSupplierId?: string | null;
  targetUserId?: string;
}

export interface StoredAlertLog {
  id: string;
  type: string;
  title: string;
  body: string;
  data: AlertData;
  timestamp: string;
}

// Global persistent storage across module re-evaluations
const globalStore = globalThis as unknown as {
  __registeredDevices?: Map<string, RegisteredDevice>;
  __recentAlertLogs?: StoredAlertLog[];
};

if (!globalStore.__registeredDevices) {
  globalStore.__registeredDevices = new Map();
}

if (!globalStore.__recentAlertLogs) {
  globalStore.__recentAlertLogs = [];
}

const devicesMap = globalStore.__registeredDevices;
const alertLogs = globalStore.__recentAlertLogs;

export function registerDeviceToken(device: RegisteredDevice): RegisteredDevice {
  const record: RegisteredDevice = {
    ...device,
    updatedAt: new Date().toISOString(),
  };
  devicesMap.set(device.fcmToken, record);
  return record;
}

export function unregisterDeviceToken(fcmToken: string): boolean {
  return devicesMap.delete(fcmToken);
}

export function getRegisteredDevices(filter?: { role?: string; supplierId?: string }): RegisteredDevice[] {
  let list = Array.from(devicesMap.values());
  if (filter?.role) {
    list = list.filter((d) => d.role.toUpperCase() === filter.role?.toUpperCase());
  }
  if (filter?.supplierId) {
    list = list.filter((d) => d.supplierId === filter.supplierId);
  }
  return list;
}

export function getRecentAlertLogs(limit = 50): StoredAlertLog[] {
  return alertLogs.slice(-limit).reverse();
}

/**
 * Dispatch an alert to registered devices via FCM push and store in local alert history.
 */
export async function dispatchAlert(payload: AlertPayload): Promise<{
  success: boolean;
  recipientCount: number;
  fcmDispatchedCount: number;
  alert: StoredAlertLog;
}> {
  const alertId = `alt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const dataPayload: AlertData = {
    ...(payload.data || {}),
    alertType: payload.type,
    type: payload.type,
    title: payload.title,
    body: payload.body,
  };

  const storedAlert: StoredAlertLog = {
    id: alertId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: dataPayload,
    timestamp: new Date().toISOString(),
  };

  // Add to in-memory recent alerts log (capped at 100)
  alertLogs.push(storedAlert);
  if (alertLogs.length > 100) {
    alertLogs.shift();
  }

  // Determine target devices
  const allDevices = Array.from(devicesMap.values());
  const targetRole = payload.targetRole || "ALL";

  const targetDevices = allDevices.filter((dev) => {
    if (payload.targetUserId && dev.userId !== payload.targetUserId) {
      return false;
    }
    const isDevAdmin = ["ADMIN", "MANAGER"].includes(dev.role.toUpperCase());
    const isDevSupplier = dev.role.toUpperCase() === "SUPPLIER";

    if (targetRole === "ADMIN" && !isDevAdmin) {
      return false;
    }
    if (targetRole === "SUPPLIER") {
      if (!isDevSupplier) return false;
      if (payload.targetSupplierId && dev.supplierId && dev.supplierId !== payload.targetSupplierId) {
        return false;
      }
    }
    if (targetRole === "ALL") {
      // If supplier item specific, don't leak to other suppliers
      if (isDevSupplier && payload.targetSupplierId && dev.supplierId && dev.supplierId !== payload.targetSupplierId) {
        return false;
      }
    }
    return true;
  });

  let fcmDispatchedCount = 0;
  const fcmTokens = targetDevices.map((d) => d.fcmToken).filter(Boolean);

  // Send via FCM if tokens and server key or service account are available
  const fcmServerKey = process.env.FCM_SERVER_KEY;
  if (fcmServerKey && fcmTokens.length > 0) {
    try {
      // Send FCM push notification (Legacy HTTP API with data + notification payload)
      const fcmPromises = fcmTokens.map((token) =>
        fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${fcmServerKey}`,
          },
          body: JSON.stringify({
            to: token,
            priority: "high",
            notification: {
              title: payload.title,
              body: payload.body,
              sound: "default",
            },
            data: dataPayload,
          }),
        }).catch((err) => {
          console.error("FCM send failed for token:", err);
          return null;
        })
      );
      const results = await Promise.all(fcmPromises);
      fcmDispatchedCount = results.filter((r) => r && r.ok).length;
    } catch (err) {
      console.error("FCM dispatch error:", err);
    }
  }

  return {
    success: true,
    recipientCount: targetDevices.length,
    fcmDispatchedCount,
    alert: storedAlert,
  };
}
