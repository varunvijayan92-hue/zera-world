"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { calculateEstimatedProfit, getMarginState } from "@/lib/profit";

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
  const [availableSuppliers, setAvailableSuppliers] = useState<Supplier[]>(suppliers);
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
  const [supplierError, setSupplierError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    sku: "",
    brand: "",
    category: "",
    barcode: "",
    description: "",
    tags: "",
    weightKg: "",
    dimensions: "",
    supplierId: suppliers[0]?.id ?? "",
    costPrice: "",
    sellingPrice: "",
    shippingCost: "",
    marketplaceFeeRate: "8",
    marketplaceFeeFixed: "25",
    packagingCost: "",
    taxRate: "5",
    imageUrls: "",
    status: "DRAFT",
  });
  const [supplierMappings, setSupplierMappings] = useState([
    {
      supplierId: suppliers[0]?.id ?? "",
      supplierSku: "",
      productUrl: "",
      cost: "",
      currency: "INR",
      minOrderQty: "",
      originCountry: "",
      processingTime: "",
      destinationCountries: "",
    },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSuppliers() {
      setIsLoadingSuppliers(true);
      setSupplierError(null);

      try {
        const response = await fetch("/api/suppliers");
        if (!response.ok) {
          throw new Error("Unable to fetch suppliers.");
        }

        const payload = await response.json();
        const nextSuppliers = Array.isArray(payload?.data)
          ? payload.data.filter((supplier: Supplier) => supplier.status === "ACTIVE" || supplier.status === undefined)
          : [];

        if (!isMounted) return;

        setAvailableSuppliers(nextSuppliers.length > 0 ? nextSuppliers : suppliers);
        setSupplierError(nextSuppliers.length === 0 ? "No active suppliers are available yet. Create one from the supplier module first." : null);
        setForm((current) => ({
          ...current,
          supplierId: current.supplierId || nextSuppliers[0]?.id || suppliers[0]?.id || "",
        }));
        setSupplierMappings((current) =>
          current.map((row, index) => ({
            ...row,
            supplierId: index === 0 ? (nextSuppliers[0]?.id || suppliers[0]?.id || "") : row.supplierId,
          }))
        );
      } catch (error) {
        if (!isMounted) return;
        setAvailableSuppliers(suppliers);
        setSupplierError(error instanceof Error ? error.message : "Unable to load suppliers.");
      } finally {
        if (isMounted) setIsLoadingSuppliers(false);
      }
    }

    loadSuppliers();
    return () => {
      isMounted = false;
    };
  }, [suppliers]);

  const marginEstimate = useMemo(() => {
    const sellingPrice = Number(form.sellingPrice || 0);
    const supplierCost = Number(form.costPrice || 0);
    const shippingCost = Number(form.shippingCost || 0);
    const marketplaceFeeRate = Number(form.marketplaceFeeRate || 0);
    const marketplaceFeeFixed = Number(form.marketplaceFeeFixed || 0);
    const packagingCost = Number(form.packagingCost || 0);
    const taxRate = Number(form.taxRate || 0);

    return calculateEstimatedProfit({
      sellingPrice,
      supplierCost,
      shippingCost,
      marketplaceFeeRate,
      marketplaceFeeFixed,
      packagingCost,
      taxRate,
    });
  }, [form.costPrice, form.marketplaceFeeFixed, form.marketplaceFeeRate, form.packagingCost, form.shippingCost, form.sellingPrice, form.taxRate]);

  const marginState = getMarginState(marginEstimate.profitMargin);

  function updateMapping(index: number, field: string, value: string) {
    setSupplierMappings((current) =>
      current.map((mapping, mappingIndex) =>
        mappingIndex === index ? { ...mapping, [field]: value } : mapping
      )
    );
  }

  function addSupplierMapping() {
    setSupplierMappings((current) => [
      ...current,
      {
        supplierId: availableSuppliers[0]?.id || "",
        supplierSku: "",
        productUrl: "",
        cost: "",
        currency: "INR",
        minOrderQty: "",
        originCountry: "",
        processingTime: "",
        destinationCountries: "",
      },
    ]);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!form.name.trim() || !form.sku.trim()) {
      setMessage("Product name and SKU are required.");
      return;
    }

    if (availableSuppliers.length === 0 && !form.supplierId) {
      setMessage("Create at least one active supplier before saving a product.");
      return;
    }

    setIsSubmitting(true);

    try {
      const normalizedImageUrls = form.imageUrls
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);

      const mainSupplierId = form.supplierId || availableSuppliers[0]?.id || "";
      const productResponse = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          sku: form.sku.trim(),
          brand: form.brand.trim(),
          category: form.category.trim(),
          barcode: form.barcode.trim(),
          description: `${form.description.trim()}${form.tags.trim() ? `\nTags: ${form.tags.trim()}` : ""}`.trim(),
          imageUrls: normalizedImageUrls,
          supplierId: mainSupplierId || undefined,
          costPrice: Number(form.costPrice || 0),
          sellingPrice: Number(form.sellingPrice || 0),
          status: form.status,
        }),
      });

      const productPayload = await productResponse.json();
      if (!productResponse.ok) {
        throw new Error(productPayload.message || "Product could not be created.");
      }

      const createdProduct = productPayload.data;
      const mappingRequests = supplierMappings
        .filter((mapping) => mapping.supplierId)
        .map(async (mapping) => {
          const supplierId = mapping.supplierId || mainSupplierId;
          if (!supplierId) return null;

          const response = await fetch("/api/supplier-product-mappings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              productId: createdProduct.id,
              supplierId,
              externalProductId: mapping.supplierSku || createdProduct.sku,
              supplierSku: mapping.supplierSku || createdProduct.sku,
              supplierProductUrl: mapping.productUrl,
              purchaseCost: Number(mapping.cost || 0),
              currency: mapping.currency || "INR",
              shippingCost: Number(form.shippingCost || 0),
              shippingDestination: mapping.destinationCountries || "India",
              estimatedDeliveryDays: Number(mapping.processingTime || 0),
              supplierAvailability: "UNKNOWN",
              mappingStatus: "ACTIVE",
              isPreferred: supplierId === mainSupplierId,
              isFallback: false,
            }),
          });

          const data = await response.json();
          if (!response.ok) {
            throw new Error(data.message || "Supplier mapping could not be saved.");
          }

          return data;
        });

      await Promise.all(mappingRequests);

      setMessage("Product saved successfully and linked to the selected supplier mappings.");
      setForm({
        name: "",
        sku: "",
        brand: "",
        category: "",
        barcode: "",
        description: "",
        tags: "",
        weightKg: "",
        dimensions: "",
        supplierId: availableSuppliers[0]?.id ?? "",
        costPrice: "",
        sellingPrice: "",
        shippingCost: "",
        marketplaceFeeRate: "8",
        marketplaceFeeFixed: "25",
        packagingCost: "",
        taxRate: "5",
        imageUrls: "",
        status: "DRAFT",
      });
      setSupplierMappings([
        {
          supplierId: availableSuppliers[0]?.id ?? "",
          supplierSku: "",
          productUrl: "",
          cost: "",
          currency: "INR",
          minOrderQty: "",
          originCountry: "",
          processingTime: "",
          destinationCountries: "",
        },
      ]);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Product could not be saved.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-slate-900">Dropshipping product form</p>
          <p className="text-sm text-slate-600">Keep product data synced with the public storefront catalogue.</p>
        </div>
        <span className="rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-700">
          {form.status}
        </span>
      </div>

      <div className="space-y-6">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Basic information</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Product name</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="Premium storage bottle" required />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">SKU</span>
              <input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="SB-001" required />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Brand</span>
              <input value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="ZeraWorld" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Category</span>
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="Home & Kitchen" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Barcode / GTIN</span>
              <input value={form.barcode} onChange={(event) => setForm({ ...form, barcode: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="8901234567890" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Tags</span>
              <input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="kitchen, premium, travel" />
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Detailed description</span>
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={4} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="Add product highlights, usage notes, features, and shipping details..." />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Weight (kg)</span>
              <input type="number" min="0" step="0.01" value={form.weightKg} onChange={(event) => setForm({ ...form, weightKg: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="0.75" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Dimensions</span>
              <input value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="32 x 24 x 18 cm" />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Supplier mapping</p>
            <button type="button" onClick={addSupplierMapping} className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">+ Add supplier</button>
          </div>

          {isLoadingSuppliers ? (
            <p className="text-sm text-slate-600">Loading active suppliers...</p>
          ) : supplierError ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{supplierError}</div>
          ) : null}

          {supplierMappings.map((mapping, index) => (
            <div key={`${index}-${mapping.supplierId || "new"}`} className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Supplier</span>
                <select value={mapping.supplierId} onChange={(event) => updateMapping(index, "supplierId", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                  {availableSuppliers.length === 0 ? <option value="">No suppliers available</option> : availableSuppliers.map((option) => <option key={option.id} value={option.id}>{option.companyName}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Supplier SKU</span>
                <input value={mapping.supplierSku} onChange={(event) => updateMapping(index, "supplierSku", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="SUP-1001" />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Supplier product URL</span>
                <input value={mapping.productUrl} onChange={(event) => updateMapping(index, "productUrl", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="https://supplier.example/products/SUP-1001" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Supplier cost</span>
                <input type="number" min="0" step="0.01" value={mapping.cost} onChange={(event) => updateMapping(index, "cost", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="290" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Currency</span>
                <input value={mapping.currency} onChange={(event) => updateMapping(index, "currency", event.target.value.toUpperCase())} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="INR" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Min order qty</span>
                <input type="number" min="0" value={mapping.minOrderQty} onChange={(event) => updateMapping(index, "minOrderQty", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="50" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Origin country</span>
                <input value={mapping.originCountry} onChange={(event) => updateMapping(index, "originCountry", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="India" />
              </label>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">Processing time (days)</span>
                <input type="number" min="0" value={mapping.processingTime} onChange={(event) => updateMapping(index, "processingTime", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="5" />
              </label>
              <label className="space-y-2 text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Destination countries</span>
                <input value={mapping.destinationCountries} onChange={(event) => updateMapping(index, "destinationCountries", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="India, UAE, Saudi Arabia" />
              </label>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Pricing</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Supplier cost</span>
              <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="299" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Selling price</span>
              <input type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => setForm({ ...form, sellingPrice: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="899" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Shipping cost</span>
              <input type="number" min="0" step="0.01" value={form.shippingCost} onChange={(event) => setForm({ ...form, shippingCost: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="40" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Marketplace fee %</span>
              <input type="number" min="0" step="0.01" value={form.marketplaceFeeRate} onChange={(event) => setForm({ ...form, marketplaceFeeRate: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="8" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Fixed marketplace fee</span>
              <input type="number" min="0" step="0.01" value={form.marketplaceFeeFixed} onChange={(event) => setForm({ ...form, marketplaceFeeFixed: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="25" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Tax rate %</span>
              <input type="number" min="0" step="0.01" value={form.taxRate} onChange={(event) => setForm({ ...form, taxRate: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="5" />
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-slate-700">Estimated profit</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${marginState.warning ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}`}>
                {marginState.label}
              </span>
            </div>
            <div className="mt-3 grid gap-2 text-sm text-slate-600 md:grid-cols-3">
              <span>Net profit: ₹{marginEstimate.netProfit.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
              <span>Margin: {marginEstimate.profitMargin.toFixed(1)}%</span>
              <span>Total costs: ₹{marginEstimate.totalCosts.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
            </div>
            {marginState.warning ? <p className="mt-2 text-sm text-amber-800">{marginState.description}</p> : <p className="mt-2 text-sm text-emerald-700">{marginState.description}</p>}
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Inventory & shipping</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Supplier stock quantity</span>
              <input type="number" min="0" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="120" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Stock sync status</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="PENDING">Pending</option>
                <option value="SUCCESS">Synced</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Last sync time</span>
              <input type="datetime-local" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Processing time (days)</span>
              <input type="number" min="0" className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="5" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Delivery estimate</span>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="4-6 business days" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Return eligibility</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="UNKNOWN">Unknown</option>
                <option value="YES">Eligible</option>
                <option value="NO">Not eligible</option>
              </select>
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Sales channels</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">ZeraWorld Store status</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="DRAFT">Draft</option>
                <option value="READY">Ready</option>
                <option value="PUBLISHED">Published</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">ZeraWorld listing ID</span>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="zws-001" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Amazon listing status</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="APPROVED">Approved</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Amazon listing ID</span>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="B0XYZ123" />
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Flipkart listing status</span>
              <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="INACTIVE">Inactive</option>
                <option value="PENDING_APPROVAL">Pending approval</option>
                <option value="APPROVED">Approved</option>
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Flipkart listing ID</span>
              <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="FK-987" />
            </label>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Advanced settings</p>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Primary supplier</span>
              <select value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                {availableSuppliers.length === 0 ? <option value="">No suppliers available</option> : availableSuppliers.map((option) => <option key={option.id} value={option.id}>{option.companyName}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">
              <span className="font-medium text-slate-700">Status</span>
              <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500">
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
            <label className="space-y-2 text-sm md:col-span-2">
              <span className="font-medium text-slate-700">Product photos</span>
              <textarea value={form.imageUrls} onChange={(event) => setForm({ ...form, imageUrls: event.target.value })} className="min-h-[88px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none transition focus:border-teal-500" placeholder="https://example.com/product-1.jpg, https://example.com/product-2.jpg" />
            </label>
          </div>
        </section>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <button type="button" onClick={() => router.refresh()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancel</button>
        <button type="button" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Save draft</button>
        <button type="submit" disabled={isSubmitting} className="rounded-xl bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? "Saving..." : "Save product"}
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
