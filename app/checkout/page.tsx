"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { calculateEstimatedProfit } from "@/lib/profit";

type CartItem = {
  id: string;
  name: string;
  sku: string;
  sellingPrice?: number | string | null;
  quantity?: number;
  imageUrls?: string[] | null;
};

const defaultAddress = {
  fullName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",
  landmark: "",
};

export default function CheckoutPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [address, setAddress] = useState(defaultAddress);
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [checkoutData, setCheckoutData] = useState<{ payment?: { checkoutKey?: string; gatewayOrderId?: string; provider?: string; message?: string; paymentId?: string; status?: string; checkoutUrl?: string }; order?: { id?: string; totalAmount?: number } } | null>(null);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("zeraworld-cart") || "[]");
    setItems(saved);
  }, []);

  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + Number(item.sellingPrice ?? 0) * Number(item.quantity ?? 1), 0);
    const shipping = subtotal > 0 ? 120 : 0;
    const taxes = subtotal * 0.05;
    const total = subtotal + shipping + taxes;
    const profit = calculateEstimatedProfit({
      sellingPrice: total,
      supplierCost: subtotal * 0.6,
      shippingCost: shipping,
      marketplaceFeeRate: 8.5,
      packagingCost: 35,
      taxRate: 5,
    });

    return { subtotal, shipping, taxes, total, profit };
  }, [items]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cart: items.map((item) => ({ productId: item.id, sku: item.sku, quantity: Number(item.quantity ?? 1) })),
          shippingAddress: address,
          paymentMethod,
          idempotencyKey: `checkout_${Date.now()}`,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.message || "Checkout failed.");
      }

      setCheckoutData(payload.data);
      setMessage(payload.data?.payment?.message || "Checkout created successfully.");

      if (payload.data?.payment?.provider === "razorpay" && payload.data?.payment?.checkoutKey) {
        const options = {
          key: payload.data.payment.checkoutKey,
          amount: Math.round(Number(payload.data.amount?.total || 0) * 100),
          currency: payload.data.amount?.currency || "INR",
          name: "ZeraWorld",
          description: "ZeraWorld order payment",
          order_id: payload.data.payment.gatewayOrderId,
          handler: function () {
            window.location.href = `/checkout/success?order=${encodeURIComponent(payload.data?.order?.id || "")}`;
          },
          theme: { color: "#173B35" },
        };

        const razorpayScript = document.createElement("script");
        razorpayScript.src = "https://checkout.razorpay.com/v1/checkout.js";
        razorpayScript.async = true;
        razorpayScript.onload = () => {
          const Razorpay = (window as any).Razorpay;
          if (Razorpay) {
            new Razorpay(options).open();
          }
        };
        document.body.appendChild(razorpayScript);
      } else {
        window.location.href = `/checkout/success?order=${encodeURIComponent(payload.data?.order?.id || "")}`;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <main className="min-h-screen bg-[#F7F4ED] px-4 py-10 text-[#173B35]">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-[#173B35]/10 bg-white p-8 text-center shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Checkout</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.06em]">Your cart is empty</h1>
          <Link href="/products" className="mt-5 inline-flex rounded-xl bg-[#173B35] px-5 py-3 text-sm font-semibold text-white">
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Checkout</p>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.07em]">Secure payment</h1>
          </div>
          <Link href="/cart" className="rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
            Back to cart
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
              <h2 className="text-xl font-black tracking-[-0.05em]">Customer details</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-[#173B35]/70">
                  Full name
                  <input required value={address.fullName} onChange={(event) => setAddress((current) => ({ ...current, fullName: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70">
                  Phone
                  <input required value={address.phone} onChange={(event) => setAddress((current) => ({ ...current, phone: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70 md:col-span-2">
                  Email
                  <input required type="email" value={address.email} onChange={(event) => setAddress((current) => ({ ...current, email: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
              <h2 className="text-xl font-black tracking-[-0.05em]">Delivery address</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-[#173B35]/70 md:col-span-2">
                  Address line 1
                  <input required value={address.addressLine1} onChange={(event) => setAddress((current) => ({ ...current, addressLine1: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70 md:col-span-2">
                  Address line 2
                  <input value={address.addressLine2} onChange={(event) => setAddress((current) => ({ ...current, addressLine2: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70">
                  City
                  <input required value={address.city} onChange={(event) => setAddress((current) => ({ ...current, city: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70">
                  State
                  <input required value={address.state} onChange={(event) => setAddress((current) => ({ ...current, state: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70">
                  Pin code
                  <input required value={address.pincode} onChange={(event) => setAddress((current) => ({ ...current, pincode: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70">
                  Country
                  <input required value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
                <label className="text-sm font-medium text-[#173B35]/70 md:col-span-2">
                  Landmark
                  <input value={address.landmark} onChange={(event) => setAddress((current) => ({ ...current, landmark: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/15 bg-[#F7F4ED] px-3 py-2.5" />
                </label>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
              <h2 className="text-xl font-black tracking-[-0.05em]">Payment method</h2>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-3">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} />
                  <span className="font-semibold">Razorpay (India customers only)</span>
                </label>
                <label className="flex items-center gap-3 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-3 opacity-70">
                  <input type="radio" name="paymentMethod" checked={paymentMethod === "manual"} onChange={() => setPaymentMethod("manual")} />
                  <span className="font-semibold">Manual demo checkout only</span>
                </label>
                <p className="text-sm text-[#173B35]/60">International payment support remains disabled until a provider and account are approved.</p>
              </div>
            </section>
          </div>

          <aside className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 shadow-[0_12px_35px_rgba(23,59,53,0.05)]">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Order summary</p>

            <div className="mt-4 space-y-3">
              {items.map((item) => (
                <div key={`${item.id}-${item.sku}`} className="flex items-center justify-between gap-4 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-3">
                  <div>
                    <p className="font-semibold text-[#173B35]">{item.name}</p>
                    <p className="text-xs text-[#173B35]/60">Qty {item.quantity ?? 1}</p>
                  </div>
                  <p className="font-bold text-[#173B35]">₹{Number(item.sellingPrice ?? 0).toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-2 text-sm text-[#173B35]/70">
              <div className="flex items-center justify-between"><span>Subtotal</span><span>₹{summary.subtotal.toLocaleString("en-IN")}</span></div>
              <div className="flex items-center justify-between"><span>Shipping</span><span>₹{summary.shipping.toLocaleString("en-IN")}</span></div>
              <div className="flex items-center justify-between"><span>Taxes</span><span>₹{summary.taxes.toLocaleString("en-IN")}</span></div>
            </div>

            <div className="mt-5 border-t border-[#173B35]/10 pt-4">
              <div className="flex items-end justify-between">
                <span className="text-sm uppercase tracking-[0.18em] text-[#173B35]/60">Final amount</span>
                <span className="text-2xl font-black text-[#173B35]">₹{summary.total.toLocaleString("en-IN")}</span>
              </div>
              <p className="mt-2 text-xs text-[#173B35]/60">Estimated profit: ₹{summary.profit.netProfit.toFixed(2)}</p>
            </div>

            <div className="mt-5 text-xs text-[#173B35]/60">
              <p>By placing this order, you agree to the <Link href="/privacy" className="font-semibold underline">privacy policy</Link> and the <Link href="/returns" className="font-semibold underline">return & refund policy</Link>.</p>
            </div>

            {message ? <div className="mt-4 rounded-xl border border-[#173B35]/10 bg-[#F7F4ED] p-3 text-sm text-[#173B35]">{message}</div> : null}

            <button type="submit" disabled={isSubmitting} className="mt-5 inline-flex w-full justify-center rounded-xl bg-[#173B35] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Processing..." : "Pay securely"}
            </button>
          </aside>
        </form>
      </div>
    </main>
  );
}
