"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Supplier = {
  id: string;
  companyName: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  supplierId?: string | null;
  supplier?: { companyName?: string | null } | null;
};

export function SupplierQuickForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
    website: "",
    provider: "",
    integrationType: "MANUAL",
    country: "",
    shippingDestinations: "",
    currency: "INR",
    minOrderQty: "",
    processingTimeDays: "",
    estimatedDeliveryDays: "",
    returnPolicy: "",
    returnAddress: "",
    status: "ACTIVE",
    connectionStatus: "PENDING",
    autoOrderProcessing: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        website: form.website.trim(),
        provider: form.provider.trim(),
        country: form.country.trim(),
        shippingDestinations: form.shippingDestinations.trim(),
        returnPolicy: form.returnPolicy.trim(),
        returnAddress: form.returnAddress.trim(),
        minOrderQty: Number(form.minOrderQty || 0),
        processingTimeDays: Number(form.processingTimeDays || 0),
        estimatedDeliveryDays: Number(form.estimatedDeliveryDays || 0),
        autoOrderProcessing: Boolean(form.autoOrderProcessing),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Supplier could not be created.");
      return;
    }

    setMessage("Supplier created successfully.");
    setForm({
      companyName: "",
      contactName: "",
      email: "",
      phone: "",
      website: "",
      provider: "",
      integrationType: "MANUAL",
      country: "",
      shippingDestinations: "",
      currency: "INR",
      minOrderQty: "",
      processingTimeDays: "",
      estimatedDeliveryDays: "",
      returnPolicy: "",
      returnAddress: "",
      status: "ACTIVE",
      connectionStatus: "PENDING",
      autoOrderProcessing: false,
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-lg font-bold text-slate-900">New supplier</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Company name</span>
          <input
            value={form.companyName}
            onChange={(event) => setForm({ ...form, companyName: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="Example: Northwind Traders"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Contact person</span>
          <input
            value={form.contactName}
            onChange={(event) => setForm({ ...form, contactName: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="Name"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier website URL</span>
          <input
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="https://supplier.example"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier platform</span>
          <input
            value={form.provider}
            onChange={(event) => setForm({ ...form, provider: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="Apex Supply Network"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Integration type</span>
          <select
            value={form.integrationType}
            onChange={(event) => setForm({ ...form, integrationType: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            <option value="MANUAL">Manual</option>
            <option value="CSV">CSV import</option>
            <option value="APP">Supported app integration</option>
            <option value="API">API</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Country</span>
          <input
            value={form.country}
            onChange={(event) => setForm({ ...form, country: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="India"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Supported shipping destinations</span>
          <input
            value={form.shippingDestinations}
            onChange={(event) => setForm({ ...form, shippingDestinations: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="India, UAE, Saudi Arabia"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Currency</span>
          <input
            value={form.currency}
            onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="INR"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Min order qty</span>
          <input
            type="number"
            min="0"
            value={form.minOrderQty}
            onChange={(event) => setForm({ ...form, minOrderQty: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="50"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Processing time (days)</span>
          <input
            type="number"
            min="0"
            value={form.processingTimeDays}
            onChange={(event) => setForm({ ...form, processingTimeDays: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="3"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Estimated delivery (days)</span>
          <input
            type="number"
            min="0"
            value={form.estimatedDeliveryDays}
            onChange={(event) => setForm({ ...form, estimatedDeliveryDays: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="7"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="supplier@example.com"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Phone</span>
          <input
            value={form.phone}
            onChange={(event) => setForm({ ...form, phone: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none ring-0 transition focus:border-teal-500"
            placeholder="+91 98765 43210"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Return policy</span>
          <textarea
            value={form.returnPolicy}
            onChange={(event) => setForm({ ...form, returnPolicy: event.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="Return window, restocking conditions, refund rules..."
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Return address</span>
          <textarea
            value={form.returnAddress}
            onChange={(event) => setForm({ ...form, returnAddress: event.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="Supplier return warehouse address"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-1 flex-col gap-4 md:flex-row md:items-end">
          <label className="space-y-2 text-sm md:w-44">
            <span className="font-medium text-slate-700">Status</span>
            <select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            >
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <label className="space-y-2 text-sm md:w-52">
            <span className="font-medium text-slate-700">Connection status</span>
            <select
              value={form.connectionStatus}
              onChange={(event) => setForm({ ...form, connectionStatus: event.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            >
              <option value="PENDING">Pending</option>
              <option value="CONNECTED">Connected</option>
              <option value="DISCONNECTED">Disconnected</option>
              <option value="REQUIRES_APPROVAL">Requires approval</option>
            </select>
          </label>
        </div>

        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.autoOrderProcessing}
            onChange={(event) => setForm({ ...form, autoOrderProcessing: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Auto order processing
        </label>

        <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white">
          Save supplier
        </button>
      </div>

      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
    </form>
  );
}

export function ProductQuickForm({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    description: "",
    supplierId: suppliers[0]?.id ?? "",
    costPrice: "",
    sellingPrice: "",
    imageUrls: "",
    status: "DRAFT",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const normalizedImageUrls = form.imageUrls
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        description: form.description.trim(),
        imageUrls: normalizedImageUrls,
        costPrice: Number(form.costPrice || 0),
        sellingPrice: Number(form.sellingPrice || 0),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Product could not be created.");
      return;
    }

    setMessage("Product created successfully.");
    setForm({
      name: "",
      sku: "",
      category: "",
      description: "",
      supplierId: suppliers[0]?.id ?? "",
      costPrice: "",
      sellingPrice: "",
      imageUrls: "",
      status: "DRAFT",
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-lg font-bold text-slate-900">New product</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Product name</span>
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="Premium storage bottle"
            required
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Product details</span>
          <textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            rows={4}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="Add a complete product description, features, sizing, care instructions, and selling highlights..."
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">SKU</span>
          <input
            value={form.sku}
            onChange={(event) => setForm({ ...form, sku: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="SB-001"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <input
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="Home & Kitchen"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier</span>
          <select
            value={form.supplierId}
            onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            {suppliers.length === 0 ? (
              <option value="">No suppliers available</option>
            ) : (
              suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.companyName}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Cost price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.costPrice}
            onChange={(event) => setForm({ ...form, costPrice: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Selling price</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.sellingPrice}
            onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Product photos</span>
          <textarea
            value={form.imageUrls}
            onChange={(event) => setForm({ ...form, imageUrls: event.target.value })}
            className="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="https://example.com/product-1.jpg, https://example.com/product-2.jpg"
          />
        </label>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <label className="space-y-2 text-sm md:w-44">
          <span className="font-medium text-slate-700">Status</span>
          <select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>

        <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white">
          Save product
        </button>
      </div>

      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
    </form>
  );
}

export function SupplierProductMappingForm({
  products,
  suppliers,
}: {
  products: Product[];
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    variantId: "",
    supplierId: suppliers[0]?.id ?? "",
    externalProductId: "",
    supplierSku: "",
    supplierVariantId: "",
    supplierProductUrl: "",
    purchaseCost: "",
    currency: "INR",
    shippingCost: "",
    shippingDestination: "",
    supplierAvailability: "IN_STOCK",
    estimatedDeliveryDays: "",
    mappingStatus: "ACTIVE",
    isPreferred: false,
    isFallback: false,
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/supplier-product-mappings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchaseCost: Number(form.purchaseCost || 0),
        shippingCost: Number(form.shippingCost || 0),
        estimatedDeliveryDays: Number(form.estimatedDeliveryDays || 0),
        isPreferred: Boolean(form.isPreferred),
        isFallback: Boolean(form.isFallback),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Supplier mapping could not be saved.");
      return;
    }

    setMessage("Supplier mapping saved successfully.");
    setForm({
      productId: products[0]?.id ?? "",
      variantId: "",
      supplierId: suppliers[0]?.id ?? "",
      externalProductId: "",
      supplierSku: "",
      supplierVariantId: "",
      supplierProductUrl: "",
      purchaseCost: "",
      currency: "INR",
      shippingCost: "",
      shippingDestination: "",
      supplierAvailability: "IN_STOCK",
      estimatedDeliveryDays: "",
      mappingStatus: "ACTIVE",
      isPreferred: false,
      isFallback: false,
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-lg font-bold text-slate-900">Supplier product mapping</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Internal product</span>
          <select
            value={form.productId}
            onChange={(event) => setForm({ ...form, productId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            {products.length === 0 ? <option value="">No products available</option> : products.map((product) => (
              <option key={product.id} value={product.id}>{product.name}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Internal variant ID</span>
          <input
            value={form.variantId}
            onChange={(event) => setForm({ ...form, variantId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="variant-01"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier</span>
          <select
            value={form.supplierId}
            onChange={(event) => setForm({ ...form, supplierId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            {suppliers.length === 0 ? <option value="">No suppliers available</option> : suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier product ID</span>
          <input
            value={form.externalProductId}
            onChange={(event) => setForm({ ...form, externalProductId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="SUP-1001"
            required
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier SKU</span>
          <input
            value={form.supplierSku}
            onChange={(event) => setForm({ ...form, supplierSku: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="SUP-1001"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Supplier variant ID</span>
          <input
            value={form.supplierVariantId}
            onChange={(event) => setForm({ ...form, supplierVariantId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="variant-1"
          />
        </label>

        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Supplier product URL</span>
          <input
            value={form.supplierProductUrl}
            onChange={(event) => setForm({ ...form, supplierProductUrl: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="https://supplier.example/products/SUP-1001"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Purchase cost</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.purchaseCost}
            onChange={(event) => setForm({ ...form, purchaseCost: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="280"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Currency</span>
          <input
            value={form.currency}
            onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="INR"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Shipping cost</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.shippingCost}
            onChange={(event) => setForm({ ...form, shippingCost: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="35"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Destination</span>
          <input
            value={form.shippingDestination}
            onChange={(event) => setForm({ ...form, shippingDestination: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="India"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Availability</span>
          <select
            value={form.supplierAvailability}
            onChange={(event) => setForm({ ...form, supplierAvailability: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Estimated delivery (days)</span>
          <input
            type="number"
            min="0"
            value={form.estimatedDeliveryDays}
            onChange={(event) => setForm({ ...form, estimatedDeliveryDays: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
            placeholder="6"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Mapping status</span>
          <select
            value={form.mappingStatus}
            onChange={(event) => setForm({ ...form, mappingStatus: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            <option value="ACTIVE">Active</option>
            <option value="PENDING">Pending</option>
            <option value="REVIEW">Review</option>
            <option value="DISABLED">Disabled</option>
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isPreferred}
            onChange={(event) => setForm({ ...form, isPreferred: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Preferred supplier
        </label>

        <label className="inline-flex items-center gap-3 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={form.isFallback}
            onChange={(event) => setForm({ ...form, isFallback: event.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
          />
          Fallback supplier
        </label>

        <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white">
          Save mapping
        </button>
      </div>

      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
    </form>
  );
}

export function InventoryQuickForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    productId: products[0]?.id ?? "",
    availableQty: "0",
    reservedQty: "0",
    damagedQty: "0",
    safetyStock: "0",
  });
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        availableQty: Number(form.availableQty || 0),
        reservedQty: Number(form.reservedQty || 0),
        damagedQty: Number(form.damagedQty || 0),
        safetyStock: Number(form.safetyStock || 0),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setMessage(payload.message || "Inventory record could not be created.");
      return;
    }

    setMessage("Inventory synced successfully.");
    setForm({
      productId: products[0]?.id ?? "",
      availableQty: "0",
      reservedQty: "0",
      damagedQty: "0",
      safetyStock: "0",
    });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div>
        <p className="text-lg font-bold text-slate-900">Update inventory</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm md:col-span-2">
          <span className="font-medium text-slate-700">Product</span>
          <select
            value={form.productId}
            onChange={(event) => setForm({ ...form, productId: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          >
            {products.length === 0 ? (
              <option value="">No products available</option>
            ) : (
              products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </option>
              ))
            )}
          </select>
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Available</span>
          <input
            type="number"
            min="0"
            value={form.availableQty}
            onChange={(event) => setForm({ ...form, availableQty: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Reserved</span>
          <input
            type="number"
            min="0"
            value={form.reservedQty}
            onChange={(event) => setForm({ ...form, reservedQty: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Damaged</span>
          <input
            type="number"
            min="0"
            value={form.damagedQty}
            onChange={(event) => setForm({ ...form, damagedQty: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span className="font-medium text-slate-700">Safety stock</span>
          <input
            type="number"
            min="0"
            value={form.safetyStock}
            onChange={(event) => setForm({ ...form, safetyStock: event.target.value })}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500"
          />
        </label>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white">
          Save inventory
        </button>
      </div>

      {message ? <p className="text-sm text-teal-700">{message}</p> : null}
    </form>
  );
}
