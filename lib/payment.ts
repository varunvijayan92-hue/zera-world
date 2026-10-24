import crypto from "node:crypto";

export type PaymentProvider = "stripe" | "razorpay" | "manual";

export type PaymentSessionRequest = {
  amount: number;
  currency?: string;
  orderId?: string;
  customerName?: string;
  email?: string;
  provider?: PaymentProvider;
  metadata?: Record<string, unknown>;
};

export type PaymentSession = {
  provider: PaymentProvider;
  orderId?: string;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "FAILED";
  paymentId: string;
  gatewayOrderId?: string;
  amount: number;
  currency: string;
  checkoutUrl?: string;
  customerName?: string;
  email?: string;
  message: string;
  checkoutKey?: string;
};

function isRazorpayConfigured() {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export async function createPaymentSession(payload: PaymentSessionRequest): Promise<PaymentSession> {
  const provider = payload.provider ?? (process.env.PAYMENT_PROVIDER as PaymentProvider | undefined) ?? "manual";
  const amount = Number(payload.amount ?? 0);
  const orderId = payload.orderId ?? `ord_${Date.now()}`;
  const currency = (payload.currency ?? "INR").toUpperCase();

  if (provider === "razorpay" && isRazorpayConfigured()) {
    const keyId = process.env.RAZORPAY_KEY_ID!;
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;

    try {
      const response = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency,
          receipt: orderId,
          payment_capture: 1,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data?.id) {
        throw new Error(data?.error?.description || "Unable to create Razorpay order.");
      }

      return {
        provider: "razorpay",
        orderId,
        status: "PENDING",
        paymentId: `pay_razorpay_${Date.now()}`,
        gatewayOrderId: data.id,
        amount,
        currency,
        customerName: payload.customerName,
        email: payload.email,
        message: "Razorpay order created in sandbox/test mode. Payment will only complete after server verification.",
        checkoutKey: keyId,
      };
    } catch {
      return {
        provider: "razorpay",
        orderId,
        status: "FAILED",
        paymentId: `pay_razorpay_failed_${Date.now()}`,
        amount,
        currency,
        customerName: payload.customerName,
        email: payload.email,
        message: "Razorpay gateway configuration is unavailable or invalid. Demo payment mode is active until credentials are approved.",
      };
    }
  }

  if (provider === "stripe" && !process.env.STRIPE_SECRET_KEY) {
    return {
      provider,
      orderId,
      status: "PENDING",
      paymentId: `pay_demo_${Date.now()}`,
      amount,
      currency,
      customerName: payload.customerName,
      email: payload.email,
      message: "Stripe is not configured in this environment. Payment gateway is running in demo mode until live credentials are added.",
      checkoutUrl: `/checkout/success?order=${encodeURIComponent(orderId)}`,
    };
  }

  return {
    provider,
    orderId,
    status: "PENDING",
    paymentId: `pay_${provider}_${Date.now()}`,
    amount,
    currency,
    customerName: payload.customerName,
    email: payload.email,
    message: `Payment session created through ${provider.toUpperCase()} and ready for checkout in test mode. No live purchase is enabled without explicit approval.`,
    checkoutUrl: `/checkout/success?order=${encodeURIComponent(orderId)}`,
  };
}

export function generateRazorpayWebhookSignature({
  payload,
  secret,
}: {
  payload: string;
  secret: string;
}) {
  if (!payload || !secret) {
    return "";
  }

  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export function verifyRazorpaySignature({
  payload,
  signature,
  secret,
}: {
  payload: string;
  signature: string;
  secret: string;
}) {
  if (!payload || !signature || !secret) {
    return false;
  }

  const expected = generateRazorpayWebhookSignature({ payload, secret });
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export async function createRefundRequest(input: {
  paymentId: string;
  amount?: number;
  currency?: string;
  reason?: string;
  notes?: string;
}) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    return {
      status: "PENDING",
      refundId: `refund_demo_${Date.now()}`,
      message: "Razorpay is not configured; refund request is queued for manual review and cannot be confirmed until the gateway is approved.",
    };
  }

  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(input.paymentId)}/refunds`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount ? Math.round(input.amount * 100) : undefined,
      currency: (input.currency || "INR").toUpperCase(),
      notes: input.notes || input.reason || "Refund requested by ZeraWorld admin",
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || "Refund could not be created.");
  }

  return {
    status: data.status || "PENDING",
    refundId: data.id,
    message: "Refund has been submitted to Razorpay and will be synced after gateway confirmation.",
  };
}
