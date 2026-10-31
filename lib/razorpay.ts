import Razorpay from "razorpay";

export class GatewayError extends Error {
  constructor(message: string, public status: number = 500) {
    super(message);
  }
}

export function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new GatewayError("Razorpay is not configured.");
  return { keyId, keySecret };
}

function client() {
  const { keyId, keySecret } = getRazorpayCredentials();
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

export function assertOrderAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 100) {
    throw new GatewayError("Payment amount must be at least 100 paise and a whole number.", 400);
  }
}

export function gatewayError(error: unknown) {
  if (error instanceof GatewayError) return error;
  const status = typeof error === "object" && error !== null && "statusCode" in error ? error.statusCode : undefined;
  return Number(status) === 401
    ? new GatewayError("Razorpay authentication failed. Check the server credentials.", 401)
    : new GatewayError("Razorpay could not process the request. Please try again.");
}

// No SDK errors or request objects are returned to the browser: those may contain credentials.
export const razorpayGateway = {
  async createOrder(input: { amount: number; currency: string; receipt: string }) {
    assertOrderAmount(input.amount);
    try {
      return await client().orders.create(input);
    } catch (error) {
      throw gatewayError(error);
    }
  },
  async fetchPayment(paymentId: string) {
    try {
      return await client().payments.fetch(paymentId);
    } catch (error) {
      throw gatewayError(error);
    }
  },
};
