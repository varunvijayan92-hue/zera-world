"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Minus, Plus, Trash2 } from "lucide-react";
import { MAX_CART_UNITS, readCart, writeCart, type CartItem } from "@/lib/cart";
import { CHECKOUT_DRAFT_KEY, SAVED_ADDRESS_KEY, emptyAddress, readCheckoutDraft, readSavedAddress, rememberAddress, type DeliveryAddress, type CheckoutDraft } from "@/lib/checkout-storage";
import { checkoutAddressSchema } from "@/lib/validators";
import { DeliveryAddressFields } from "@/components/delivery-address-fields";
import { CheckoutProgress, CheckoutSummary, money } from "@/components/checkout-summary";

type Quote = { fingerprint: string; items: CartItem[]; amount: CheckoutDraft["amount"] };

export default function CheckoutPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [address, setAddress] = useState<DeliveryAddress>({ ...emptyAddress });
  const [accountAddresses, setAccountAddresses] = useState<{ id: string; label: string; address: DeliveryAddress }[]>([]);
  const [isCustomer, setIsCustomer] = useState(false);
  const [savedAddress, setSavedAddress] = useState<DeliveryAddress | null>(null);
  const [saveAddress, setSaveAddress] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [retry, setRetry] = useState(0);
  const [locating, setLocating] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const requestBody = JSON.stringify({ cart: items.map((item) => ({ productId: item.id, sku: item.sku, quantity: item.quantity })) });
  const currentQuote = quote?.fingerprint === requestBody ? quote : null;
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    setItems(readCart(localStorage));
    const saved = readSavedAddress(localStorage);
    const draft = readCheckoutDraft(sessionStorage);
    if (saved) { setSavedAddress(saved); setSaveAddress(true); }
    if (draft || saved) setAddress(draft?.shippingAddress || saved!);
    void fetch("/api/account/addresses").then(async (response) => {
      if (!response.ok) return;
      const result = await response.json(); setIsCustomer(true); setAccountAddresses(result.addresses);
      if (!draft && !saved && result.addresses[0]) setAddress(result.addresses[0].address);
    }).catch(() => {});
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || JSON.parse(requestBody).cart.length === 0) return;
    const controller = new AbortController();
    setQuote(null);
    setQuoteError("");
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/checkout/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody, signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || "Order amount could not be checked.");
        if (!controller.signal.aborted) setQuote({ ...result, fingerprint: requestBody });
      } catch (error) {
        if (!controller.signal.aborted) setQuoteError(error instanceof Error ? error.message : "Order amount could not be checked.");
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [requestBody, ready, retry]);

  function changeItems(next: CartItem[]) {
    if (next.some(item => !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_CART_UNITS)) return;
    if (next.reduce((sum, item) => sum + item.quantity, 0) > MAX_CART_UNITS) { setMessage("A cart can contain a maximum of 10 units."); return; }
    setMessage("");
    setItems(next);
    try { writeCart(localStorage, next); } catch { setMessage("Your browser could not save the cart. Enable browser storage to continue."); }
  }

  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentQuote || continuing || locating) return;
    const parsed = checkoutAddressSchema.safeParse(address);
    if (!parsed.success) { setMessage("Please complete your contact and delivery address."); return; }
    setContinuing(true);
    try {
      if (saveAddress && isCustomer && !accountAddresses.some((entry) => JSON.stringify(entry.address) === JSON.stringify(parsed.data))) {
        const response = await fetch("/api/account/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: "Delivery", address: parsed.data }) });
        const result = await response.json(); if (!response.ok) throw Error(result.message || "Address could not be saved.");
      }
      writeCart(localStorage, currentQuote.items);
      rememberAddress(localStorage, parsed.data, saveAddress);
      sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify({ items: currentQuote.items, amount: currentQuote.amount, shippingAddress: parsed.data, createdAt: Date.now() }));
      const auth = await fetch("/api/auth/me", { cache: "no-store" });
      if (!auth.ok) throw Error("Unable to check your login. Please try again.");
      const { user } = await auth.json();
      router.push(user?.role === "CUSTOMER" ? "/checkout/payment" : "/login?next=%2Fcheckout%2Fpayment");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Checkout details could not be saved."); setContinuing(false); }
  }

  if (!ready) return <main className="min-h-screen bg-[#F7F4ED] p-10 text-center text-[#173B35]" role="status">Loading your order...</main>;
  if (!items.length) return <main className="min-h-screen bg-[#F7F4ED] p-10 text-center text-[#173B35]"><h1 className="text-3xl font-bold">Choose an item to get started</h1><Link href="/products" className="mt-6 inline-block rounded-xl bg-[#173B35] px-6 py-3 text-white">Browse products</Link></main>;

  return <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#173B35]/60">Your order</p><h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">Confirm items & delivery</h1></div><Link href="/products" className="text-sm font-semibold underline underline-offset-4">Continue shopping</Link></div>
      <CheckoutProgress step={1} />
      <form onSubmit={confirm} className="grid items-start gap-6 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 md:p-7">
            <h2 className="text-xl font-bold">1. Check items & quantity</h2><p id="checkout-quantity-limit" className="mt-1 text-sm text-[#173B35]/65">Use the minus and plus buttons to choose your quantity. Maximum 10 units per cart; the amount updates automatically.</p>
            <div className="mt-5 space-y-4">{(currentQuote?.items || items).map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#173B35]/10 p-4">
              <div className="min-w-0 basis-full sm:flex-1 sm:basis-0"><Link href={`/products/${item.id}`} className="break-words font-bold hover:underline">{item.name}</Link><p className="mt-1 text-sm text-[#173B35]/65">{money(item.sellingPrice)} each</p></div>
              <div role="group" aria-label={`Quantity for ${item.name}`} aria-describedby="checkout-quantity-limit"><p className="mb-1 text-xs font-semibold">Quantity</p><div className="inline-flex items-center rounded-lg border border-[#173B35]/20">
                <button type="button" aria-label={`Decrease quantity for ${item.name}`} disabled={item.quantity <= 1 || continuing} onClick={() => changeItems(items.map(entry => entry.id === item.id ? { ...entry, quantity: entry.quantity - 1 } : entry))} className="flex h-11 w-11 items-center justify-center rounded-l-lg hover:bg-[#F7F4ED] disabled:opacity-30"><Minus size={18} /></button>
                <output aria-live="polite" aria-label={`Selected quantity for ${item.name}`} className="w-7 text-center font-semibold tabular-nums">{item.quantity}</output>
                <button type="button" aria-label={`Increase quantity for ${item.name}`} disabled={totalUnits >= MAX_CART_UNITS || continuing} onClick={() => changeItems(items.map(entry => entry.id === item.id ? { ...entry, quantity: entry.quantity + 1 } : entry))} className="flex h-11 w-11 items-center justify-center rounded-r-lg hover:bg-[#F7F4ED] disabled:opacity-30"><Plus size={18} /></button>
              </div></div>
              <div className="min-w-20 text-right"><p className="font-bold">{money(item.sellingPrice * item.quantity)}</p><button type="button" aria-label={`Remove ${item.name}`} onClick={() => changeItems(items.filter((entry) => entry.id !== item.id))} className="mt-2 inline-flex items-center gap-1 text-xs text-red-700"><Trash2 size={13} /> Remove</button></div>
            </div>)}</div>
          </section>
          <section className="rounded-[28px] border border-[#173B35]/10 bg-white p-5 md:p-7">
            <h2 className="text-xl font-bold">2. Confirm delivery address</h2>
            {isCustomer ? <label className="mt-4 block text-sm font-semibold">Account addresses<select aria-label="Saved account address" className="mt-2 block w-full rounded-xl border p-3" defaultValue="" onChange={(event) => { const selected = accountAddresses.find((entry) => entry.id === event.target.value); if (selected) setAddress(selected.address); }}><option value="">Choose a saved address or enter a new one</option>{accountAddresses.map((entry) => <option key={entry.id} value={entry.id}>{entry.label}: {entry.address.addressLine1}, {entry.address.city}</option>)}</select></label> : <p className="mt-4 text-sm"><Link href="/login" className="font-semibold underline">Sign in</Link> before placing the order to see it in your account and request returns.</p>}
            {savedAddress ? <div className="mt-4 rounded-2xl bg-[#F7F4ED] p-4"><p className="text-sm font-semibold">Saved address | {savedAddress.fullName}</p><p className="mt-1 text-sm text-[#173B35]/70">{savedAddress.addressLine1}, {savedAddress.city} {savedAddress.pincode}</p><div className="mt-3 flex gap-4 text-sm"><button type="button" onClick={() => { setAddress(savedAddress); setSaveAddress(true); }} className="font-semibold underline">Use saved address</button><button type="button" onClick={() => { try { localStorage.removeItem(SAVED_ADDRESS_KEY); setSavedAddress(null); setSaveAddress(false); } catch { setMessage("The saved address could not be removed. Try again."); } }} className="text-red-700 underline">Forget address</button></div></div> : null}
            <DeliveryAddressFields value={address} onChange={setAddress} onLocatingChange={setLocating} />
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl bg-[#F7F4ED] p-4 text-sm"><input type="checkbox" checked={saveAddress} onChange={(event) => setSaveAddress(event.target.checked)} className="mt-1 accent-[#173B35]" /><span><span className="font-semibold">Save this address for my next shipment</span><span className="mt-1 block text-xs text-[#173B35]/65">{isCustomer ? "Saved to your account and this browser for your next shipment." : "Saved on this browser. Sign in to save addresses to your account."}</span></span></label>
          </section>
        </div>
        <aside className="rounded-[28px] border border-[#173B35]/10 bg-white p-6 lg:sticky lg:top-6">
          <CheckoutSummary amount={currentQuote?.amount || null} />
          {quoteError ? <div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{quoteError}<button type="button" onClick={() => setRetry((value) => value + 1)} className="mt-2 block font-semibold underline">Check amount again</button></div> : null}
          {message ? <p role="alert" className="mt-4 text-sm text-red-700">{message}</p> : null}
          <button type="submit" disabled={!currentQuote || continuing || locating} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173B35] px-4 py-4 text-sm font-semibold text-white disabled:opacity-50">{continuing ? "Continuing..." : "Confirm & continue to payment"}<ArrowRight size={17} /></button>
          <p className="mt-3 text-xs leading-relaxed text-[#173B35]/60">Review your items and address before continuing. Choose your payment option on the next page.</p>
        </aside>
      </form>
    </div>
  </main>;
}
