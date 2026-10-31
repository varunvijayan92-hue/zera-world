export type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export function upiCheckoutDisplay(mode: "upi" | "qr") {
  return { config: { display: {
    blocks: { upi: { name: mode === "qr" ? "Scan with any UPI app" : "Pay with UPI",
      instruments: [mode === "qr" ? { method: "upi", flows: ["qr"] } : { method: "upi" }],
    } },
    sequence: ["block.upi"], preferences: { show_default_blocks: false },
  } } };
}

type CheckoutOptions = {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  config?: ReturnType<typeof upiCheckoutDisplay>["config"];
};

type RazorpayInstance = {
  open(): void;
  close(): void;
  on(event: "payment.failed", callback: (response: { error?: { description?: string } }) => void): void;
};
type RazorpayConstructor = new (options: CheckoutOptions & {
  handler(response: RazorpayResponse): void;
  modal: { ondismiss(): void };
}) => RazorpayInstance;

declare global {
  interface Window { Razorpay?: RazorpayConstructor }
}

let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;
  loading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    const timer = window.setTimeout(() => fail(), 20000);
    const fail = () => {
      window.clearTimeout(timer);
      script.remove();
      reject(new Error("Payment checkout could not load. Check your connection and try again."));
    };
    script.onload = () => {
      window.clearTimeout(timer);
      if (!window.Razorpay) { fail(); return; }
      resolve();
    };
    script.onerror = fail;
    document.body.appendChild(script);
  }).catch((error: unknown) => { loading = null; throw error; });
  return loading;
}

export async function openRazorpay(options: CheckoutOptions): Promise<RazorpayResponse> {
  await loadRazorpay();
  const Constructor = window.Razorpay;
  if (!Constructor) throw new Error("Payment checkout is unavailable.");
  return new Promise((resolve, reject) => {
    let settled = false;
    const checkout = new Constructor({
      ...options,
      handler(response) {
        if (settled) return;
        settled = true;
        resolve(response);
      },
      modal: { ondismiss() {
        if (settled) return;
        settled = true;
        reject(new Error("Payment cancelled. You can reopen checkout to try again."));
      } },
    });
    checkout.on("payment.failed", (response) => {
      if (settled) return;
      settled = true;
      checkout.close();
      reject(new Error(response.error?.description || "Payment failed. Please try again."));
    });
    checkout.open();
  });
}
