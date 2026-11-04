"use client";
import { COD_REQUEST_KEY } from "@/lib/cash-on-delivery";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QrCode, Smartphone } from "lucide-react";
import { loadRazorpay, openRazorpay, upiCheckoutDisplay, type RazorpayResponse } from "@/lib/razorpay-browser";
import { CHECKOUT_DRAFT_KEY, readCheckoutDraft, type CheckoutDraft } from "@/lib/checkout-storage";
import { getPostPaymentRedirectPath } from "@/lib/navigation-paths";
import { CheckoutProgress, CheckoutSummary, money } from "@/components/checkout-summary";

type CheckoutSession = {
  order_id: string | null;
  amount: number;
  currency: string;
  data: { order: { id: string }; payment: { provider: string; checkoutKey?: string } };
};

export default function PaymentPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<CheckoutDraft | null>(null);
  const [paymentChoice, setPaymentChoice] = useState<"upi" | "qr" | "cod" | "gift_card">("upi");
  const [giftCards, setGiftCards] = useState<{ code: string; balance: string }[]>([]);
  const [giftCardCode, setGiftCardCode] = useState("");
  const [codAvailable, setCodAvailable] = useState(false);
  const [codChecked, setCodChecked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationPending, setVerificationPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const submissionKey = useRef<string | null>(null);
  const cachedCheckout = useRef<{ fingerprint: string; session: CheckoutSession } | null>(null);
  const pendingVerification = useRef<RazorpayResponse | null>(null);
  const lastRequest = useRef("");
  const submitting = useRef(false);

  useEffect(() => {
    const stored = readCheckoutDraft(sessionStorage);
    if (!stored) { router.replace("/checkout"); return; }
    let active = true;
    // CheckoutLayout already requires a signed-in customer. The create-order API
    // validates the same session before creating an order or contacting Razorpay.
    setDraft(stored);
    void fetch("/api/account/gift-cards", { cache: "no-store" }).then(async response => { const result = await response.json(); if (active && response.ok) setGiftCards(result.cards); }).catch(() => {});
    fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cart: stored.items.map(item => ({ productId: item.id, sku: item.sku, quantity: item.quantity })) }) }).then(async response => {
      const result = await response.json();
      if (!active) return;
      setCodAvailable(response.ok && result.codAvailable === true); setCodChecked(true);
    }).catch(() => { if (active) { setCodChecked(true); setCodAvailable(false); } });
    return () => { active = false; };
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    if (submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setMessage(null);
    try {
      if (paymentChoice === "gift_card" && !pendingVerification.current) {
        if (!giftCardCode) throw Error("Choose a gift card.");
        const body = { cart: draft.items.map(item => ({ productId: item.id, sku: item.sku, quantity: item.quantity })), shippingAddress: draft.shippingAddress, paymentMethod: "gift_card", giftCardCode, expectedTotalPaise: Math.round(draft.amount.total * 100) };
        const fingerprint = JSON.stringify(body), storageKey = "zeraworld-gift-card-request";
        let saved: { fingerprint?: string; key?: string } | null = null;
        try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch { /* Generate a stable checkout reference below. */ }
        const key = saved?.fingerprint === fingerprint && saved.key ? saved.key : crypto.randomUUID();
        sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
        const response = await fetch("/api/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, idempotencyKey: key }) });
        const result = await response.json();
        if (response.status === 401) { router.push("/login?next=%2Fcheckout"); return; }
        if (!response.ok || result.data?.payment?.provider !== "GIFT_CARD" || result.payment_status !== "PAID") throw Error(result.message || "Gift-card order could not be confirmed. Check your orders before retrying.");
        localStorage.removeItem("zeraworld-cart"); sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); sessionStorage.removeItem(storageKey);
        window.location.assign(getPostPaymentRedirectPath()); return;
      }
      if (paymentChoice === "cod" && !pendingVerification.current) {
        if (!codAvailable) throw Error("Cash on delivery is not available for this cart.");
        const body = { cart: draft.items.map(item => ({ productId: item.id, sku: item.sku, quantity: item.quantity })), shippingAddress: draft.shippingAddress, paymentMethod: "cod", expectedTotalPaise: Math.round(draft.amount.total * 100) };
        const fingerprint = JSON.stringify(body);
        let stored: { fingerprint?: string; key?: string } | null = null;
        try { stored = JSON.parse(sessionStorage.getItem(COD_REQUEST_KEY) || "null"); } catch { /* Create a new checkout reference below. */ }
        const key = stored?.fingerprint === fingerprint && stored.key ? stored.key : crypto.randomUUID();
        sessionStorage.setItem(COD_REQUEST_KEY, JSON.stringify({ fingerprint, key }));
        const response = await fetch("/api/create-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, idempotencyKey: key }) });
        const result = await response.json();
        if (response.status === 401) { router.push("/login?next=%2Fcheckout"); return; }
        if (!response.ok || result.data?.payment?.provider !== "COD") throw Error(result.message || "COD order could not be placed. Check your orders before retrying.");
        localStorage.removeItem("zeraworld-cart"); sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); sessionStorage.removeItem(COD_REQUEST_KEY);
        window.location.assign(getPostPaymentRedirectPath());
        return;
      }
      // A network error during verification must not start a second payment.
      if (!pendingVerification.current) {
        const requestBody = {
          cart: draft.items.map((item) => ({ productId: item.id, sku: item.sku, quantity: Number(item.quantity ?? 1) })),
          shippingAddress: draft.shippingAddress,
          paymentMethod: "razorpay",
          expectedTotalPaise: Math.round(draft.amount.total * 100),
        };
        const fingerprint = JSON.stringify(requestBody);
        await loadRazorpay();
        let session = cachedCheckout.current?.fingerprint === fingerprint ? cachedCheckout.current.session : null;
        if (!session) {
          if (lastRequest.current !== fingerprint) {
            submissionKey.current = crypto.randomUUID();
            lastRequest.current = fingerprint;
          }
          const response = await fetch("/api/create-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...requestBody, idempotencyKey: submissionKey.current }),
          });
          const payload = await response.json();
          if (response.status === 401) { router.push("/login?next=%2Fcheckout"); return; }
          if (!response.ok) throw new Error(payload?.message || "Checkout could not be started.");
          session = payload as CheckoutSession;
          cachedCheckout.current = { fingerprint, session };
        }
        if (!session) throw new Error("Checkout could not be started.");
        if (!session.order_id || !session.data.payment.checkoutKey) throw new Error("Payment checkout is not configured.");
        pendingVerification.current = await openRazorpay({
          key: session.data.payment.checkoutKey,
          amount: session.amount,
          currency: session.currency,
          order_id: session.order_id,
          name: "ZeraWorld",
          description: "ZeraWorld order payment",
          prefill: { name: draft.shippingAddress.fullName, email: draft.shippingAddress.email, contact: draft.shippingAddress.phone },
          theme: { color: "#173B35" },
          ...upiCheckoutDisplay(paymentChoice === "qr" ? "qr" : "upi"),
        });
      }
      setVerificationPending(true);
      setMessage("Verifying your payment...");
      const verified = await fetch("/api/verify-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingVerification.current),
      });
      const result = await verified.json();
      if (!verified.ok || !result.success) throw new Error(result.message || "Payment verification failed. Try verification again before making another payment.");
      if (result.payment_status === "PAID") localStorage.removeItem("zeraworld-cart");
      sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
      window.location.assign(getPostPaymentRedirectPath());
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Checkout failed.";
      setMessage(pendingVerification.current ? `${detail} Submit again to retry verification; no new payment will be started.` : detail);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  };

  if (!draft) return <main className="min-h-screen bg-[#F7F4ED] p-10 text-center text-[#173B35]" role="status">{message || "Loading your confirmed order..."}</main>;
  const address = draft.shippingAddress;
  return <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Secure checkout</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Choose how to pay</h1></div>{!verificationPending && !isSubmitting ? <Link href="/checkout" className="text-sm font-semibold underline underline-offset-4">Edit items or address</Link> : null}</div>
      <CheckoutProgress step={2} />
      <form onSubmit={handleSubmit} className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-6 md:p-7">
            <h2 className="text-xl font-bold">Payment options</h2><p className="mt-2 text-sm text-[#173B35]/65">Pay securely with Razorpay, or choose cash on delivery when available for every item.</p>
            <fieldset disabled={isSubmitting || verificationPending} className="mt-5 space-y-3">
              <legend className="sr-only">Choose your payment method</legend>
              {(["upi", "qr"] as const).map((choice) => <label key={choice} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${paymentChoice === choice ? "border-[#173B35] bg-[#F7F4ED]" : "border-[#173B35]/15"}`}>
                <input type="radio" name="paymentChoice" value={choice} checked={paymentChoice === choice} onChange={() => setPaymentChoice(choice)} className="mt-1 accent-[#173B35]" />
                {choice === "upi" ? <Smartphone className="mt-0.5 shrink-0" size={23} /> : <QrCode className="mt-0.5 shrink-0" size={23} />}
                <span><span className="block font-bold">{choice === "upi" ? "UPI apps" : "Scan a UPI QR code"}</span><span className="mt-1 block text-sm text-[#173B35]/65">{choice === "upi" ? "Choose a supported UPI app in Razorpay and approve the payment." : "Open a UPI app on another device and scan the QR shown by Razorpay."}</span></span>
              </label>)}
              <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${paymentChoice === "gift_card" ? "border-[#173B35] bg-[#F7F4ED]" : "border-[#173B35]/15"}`}><input type="radio" name="paymentChoice" value="gift_card" checked={paymentChoice === "gift_card"} onChange={() => setPaymentChoice("gift_card")} className="mt-1 accent-[#173B35]" /><span><span className="block font-bold">Gift card</span><span className="mt-1 block text-sm opacity-65">Use a card assigned to your account that covers the full order total. Unused balance stays on your card.</span></span></label>
              {paymentChoice === "gift_card" ? <label className="block text-sm font-semibold">Choose gift card<select aria-label="Choose gift card" value={giftCardCode} onChange={event => setGiftCardCode(event.target.value)} className="mt-2 block w-full rounded-xl border p-3"><option value="">Select your gift card</option>{giftCards.map(card => <option key={card.code} value={card.code} disabled={Number(card.balance) < draft.amount.total}>{card.code} - {money(Number(card.balance))}{Number(card.balance) < draft.amount.total ? " (insufficient balance)" : ""}</option>)}</select>{!giftCards.length ? <span className="mt-2 block text-xs">No valid gift cards with a balance are available on your account.</span> : null}</label> : null}
              {codAvailable ? <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${paymentChoice === "cod" ? "border-[#173B35] bg-[#F7F4ED]" : "border-[#173B35]/15"}`}><input type="radio" name="paymentChoice" value="cod" checked={paymentChoice === "cod"} onChange={() => setPaymentChoice("cod")} className="mt-1 accent-[#173B35]" /><span><span className="block font-bold">Cash on delivery</span><span className="mt-1 block text-sm text-[#173B35]/65">Place your order now and pay the courier on delivery. Your supplier can start processing it immediately.</span></span></label> : <p className="text-sm text-[#173B35]/65">{codChecked ? "Cash on delivery is unavailable for one or more items. You can use prepaid payment." : "Checking cash on delivery availability..."}</p>}
            </fieldset>
            <p className="mt-4 text-xs leading-relaxed text-[#173B35]/60">Available UPI apps and QR options depend on your device and Razorpay account. The payment amount is filled in automatically.</p>
          </section>
          <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-6 md:p-7">
            <h2 className="text-xl font-bold">Delivery confirmed</h2><p className="mt-4 font-semibold">{address.fullName}</p><p className="mt-1 text-sm leading-relaxed text-[#173B35]/75">{[address.addressLine1, address.addressLine2, address.city, address.state, address.pincode, address.country].filter(Boolean).join(", ")}</p><p className="mt-2 text-sm text-[#173B35]/70">{address.phone} | {address.email}</p>
            <div className="mt-5 space-y-3 border-t border-[#173B35]/10 pt-5">{draft.items.map((item) => <div key={item.id} className="flex justify-between gap-4 text-sm"><span>{item.name} <span className="text-[#173B35]/60">x {item.quantity}</span></span></div>)}</div>
          </section>
        </div>
        <aside className="rounded-[28px] border border-[#173B35]/10 bg-white p-6 lg:sticky lg:top-6">
          <CheckoutSummary amount={draft.amount} />
          {message ? <p role="status" aria-live="polite" className="mt-4 rounded-xl bg-[#F7F4ED] p-3 text-sm">{message}</p> : null}
          <button type="submit" disabled={isSubmitting} className="mt-6 w-full rounded-xl bg-[#173B35] px-4 py-4 text-sm font-semibold text-white disabled:opacity-50">{isSubmitting ? "Processing..." : verificationPending ? "Verify payment again" : paymentChoice === "gift_card" ? `Pay ${money(draft.amount.total)} with gift card` : paymentChoice === "cod" ? `Place order - pay ${money(draft.amount.total)} on delivery` : `Pay ${money(draft.amount.total)} with ${paymentChoice === "qr" ? "QR code" : "UPI"}`}</button>
          <p className="mt-4 text-xs leading-relaxed text-[#173B35]/60">By paying, you agree to our <Link href="/privacy" className="underline">privacy policy</Link> and <Link href="/returns" className="underline">return & refund policy</Link>.</p>
        </aside>
      </form>
    </div>
  </main>;
}
