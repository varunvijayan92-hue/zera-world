"use client";

import { useRef, useState, type FormEvent } from "react";
import type { AdminProduct } from "@/lib/admin-types";
import { categoryDisplayName, type MenuCategory } from "@/lib/category";
import { ProductPhotoManager } from "./product-photo-manager";
import { useClientReady } from "./use-client-ready";
import { AdminProductList } from "./admin-product-list";

type SupplierOption = { id: string; companyName: string };

const blank = { name: "", sku: "", description: "", specifications: "", manufacturerInfo: "", brand: "", size: "", warranty: "", trend: "", inTheBox: "", categoryId: "", parentCategoryId: "", subcategoryId: "", supplierId: "", sellingPrice: "", mrp: "", hsnCode: "", costPrice: "", status: "DRAFT", availableQty: "0", gstRate: "", deliveryCharge: "", handlingCharge: "", returnDays: "", isReturnable: true };

export function ProductEditor({ initialProducts, categories, suppliers }: { initialProducts: AdminProduct[]; categories: MenuCategory[]; suppliers: SupplierOption[] }) {
  const ready = useClientReady();
  const editorRef = useRef<HTMLFormElement>(null);
  const [products, setProducts] = useState(initialProducts);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [listMessage, setListMessage] = useState("");
  const selected = products.find((product) => product.id === selectedId);
  const parentCategories = categories.filter((category) => !category.parentId);
  const subcategories = form.parentCategoryId ? categories.filter((category) => category.parentId === form.parentCategoryId) : [];

  function select(id: string) {
    setListMessage("");
    setSelectedId(id); setMessage("");
    const product = products.find((entry) => entry.id === id);
    const matchedCategory = product?.categoryId ? categories.find((category) => category.id === product.categoryId) : null;
    const parentCategoryId = matchedCategory?.parentId || matchedCategory?.id || "";
    const subcategoryId = matchedCategory?.parentId ? matchedCategory.id : "";
    setForm(product ? { name: product.name, sku: product.sku, description: product.description, specifications: product.specifications || "", manufacturerInfo: product.manufacturerInfo || "", brand: product.brand, size: product.size || "", warranty: product.warranty || "", trend: product.trend || "", inTheBox: product.inTheBox || "", categoryId: product.categoryId || "", parentCategoryId, subcategoryId, supplierId: product.supplierId || "", sellingPrice: String(product.sellingPrice), mrp: product.mrp == null ? "" : String(product.mrp), hsnCode: product.hsnCode || "", costPrice: String(product.costPrice), status: product.status, availableQty: String(product.availableQty), gstRate: product.gstRate ? String(product.gstRate) : "", deliveryCharge: product.deliveryCharge == null ? "" : String(product.deliveryCharge), handlingCharge: product.handlingCharge ? String(product.handlingCharge) : "", returnDays: product.returnDays ? String(product.returnDays) : "", isReturnable: product.isReturnable } : blank);
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    setListMessage("");
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const selectedSupplierName = suppliers.find((supplier) => supplier.id === form.supplierId)?.companyName ?? selected?.supplierName ?? "";
      const resolvedCategoryId = form.subcategoryId || form.parentCategoryId || "";
      const body = {
        gstRate: form.gstRate === "" ? 0 : Number(form.gstRate),
        deliveryCharge: form.deliveryCharge === "" ? 0 : Number(form.deliveryCharge),
        handlingCharge: form.handlingCharge === "" ? 0 : Number(form.handlingCharge),
        returnDays: form.returnDays === "" ? 0 : Number(form.returnDays),
        isReturnable: form.isReturnable,
        name: form.name,
        sku: form.sku,
        description: form.description,
        specifications: form.specifications.trim() || null,
        manufacturerInfo: form.manufacturerInfo.trim() || null,
        brand: form.brand,
        size: form.size.trim() || null,
        warranty: form.warranty.trim() || null,
        trend: form.trend.trim() || null,
        inTheBox: form.inTheBox.trim() || null,
        categoryId: resolvedCategoryId,
        supplierId: form.supplierId || "",
        sellingPrice: Number(form.sellingPrice), mrp: form.mrp.trim() ? Number(form.mrp) : null, hsnCode: form.hsnCode.trim() || null,
        costPrice: Number(form.costPrice || 0),
        status: form.status,
        ...(!selectedId ? { availableQty: Number(form.availableQty) } : {})
      };
      const response = await fetch(selectedId ? `/api/products/${selectedId}` : "/api/products", { method: selectedId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Product could not be saved.");
      const supplierId = result.data?.supplierId ?? null;
      const product: AdminProduct = { ...result.data, supplierId, supplierName: supplierId ? result.data?.supplier?.companyName ?? (selectedSupplierName || null) : null, gstRate: Number(result.data.gstRate || 0), deliveryCharge: result.data.deliveryCharge == null ? null : Number(result.data.deliveryCharge), handlingCharge: Number(result.data.handlingCharge || 0), returnDays: Number(result.data.returnDays || 0), sellingPrice: Number(result.data.sellingPrice), mrp: result.data.mrp == null ? null : Number(result.data.mrp), hsnCode: result.data.hsnCode || null, costPrice: Number(result.data.costPrice || 0), availableQty: selected?.availableQty ?? Number(form.availableQty), description: result.data.description || "", specifications: result.data.specifications || null, manufacturerInfo: result.data.manufacturerInfo || null, brand: result.data.brand || "", size: result.data.size || null, warranty: result.data.warranty || null, trend: result.data.trend || null, inTheBox: result.data.inTheBox || null };
      setProducts((current) => selectedId ? current.map((entry) => entry.id === selectedId ? product : entry) : [product, ...current]);
      setSelectedId(product.id); setMessage(product.status === "ACTIVE" ? "Product saved and available on the website. Add or update its photos below." : "Product saved as a draft. Add photos, then set status to Active when ready.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Product could not be saved."); }
    finally { setBusy(false); }
  }
  function editFromList(id: string) {
    select(id);
    editorRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    requestAnimationFrame(() => editorRef.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true }));
  }
  async function removeProduct(product: AdminProduct) {
    if (!window.confirm(`Delete ${product.name}? This removes the product and its unused stock records. Products with order or financial history must be archived instead.`)) return;
    setBusy(true); setMessage(""); setListMessage("");
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw Error(result.message || "Product could not be deleted.");
      setProducts(current => current.filter(entry => entry.id !== product.id));
      if (selectedId === product.id) { setSelectedId(""); setForm(blank); }
      setListMessage("Product deleted.");
    } catch (error) { setListMessage(error instanceof Error ? error.message : "Product could not be deleted."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><section className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-4"><label className="block min-w-0 flex-1 text-sm font-semibold">Select a product<select aria-label="Select a product" disabled={!ready || busy} value={selectedId} onChange={(event) => select(event.target.value)} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3"><option value="">+ Add a new product</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>{selected?.status === "ACTIVE" ? <a href={`/products/${selected.id}`} target="_blank" rel="noreferrer" className="mt-6 text-sm font-semibold underline">View product on website</a> : null}</div><form ref={editorRef} onSubmit={save} className="mt-6"><fieldset disabled={!ready || busy} className="grid gap-4 md:grid-cols-2">{([['name','Product name'],['sku','SKU'],['brand','Brand']] as const).map(([key,label]) => <label key={key} className="text-sm font-semibold">{label}<input required={key !== 'brand'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label>)}<label className="text-sm font-semibold">Size<input value={form.size} onChange={(event) => setForm((current) => ({ ...current, size: event.target.value }))} placeholder="S, M, L, XL" className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Warranty<input value={form.warranty} onChange={(event) => setForm((current) => ({ ...current, warranty: event.target.value }))} placeholder="1 year" className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Trend<input value={form.trend} onChange={(event) => setForm((current) => ({ ...current, trend: event.target.value }))} placeholder="Minimalist" className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">In the box<input value={form.inTheBox} onChange={(event) => setForm((current) => ({ ...current, inTheBox: event.target.value }))} placeholder="Dress, tags, dust bag" className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Delivery charge (INR)<input type="number" min="0" step="0.01" value={form.deliveryCharge} onChange={(event) => setForm((current) => ({ ...current, deliveryCharge: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Main category<select aria-label="Main category" value={form.parentCategoryId} onChange={(event) => setForm((current) => ({ ...current, parentCategoryId: event.target.value, subcategoryId: current.parentCategoryId === event.target.value ? current.subcategoryId : "", categoryId: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3"><option value="">No category selected</option>{parentCategories.map((category) => <option key={category.id} value={category.id}>{categoryDisplayName(category, categories)}{category.isVisible ? "" : " (hidden menu)"}</option>)}</select></label><label className="text-sm font-semibold">Subcategory<select aria-label="Subcategory" value={form.subcategoryId} onChange={(event) => setForm((current) => ({ ...current, subcategoryId: event.target.value, categoryId: event.target.value || current.parentCategoryId }))} disabled={!form.parentCategoryId} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3 disabled:cursor-not-allowed disabled:bg-[#F7F4ED]"><option value="">No subcategory</option>{subcategories.map((category) => <option key={category.id} value={category.id}>{categoryDisplayName(category, categories)}</option>)}</select></label><label className="text-sm font-semibold">Supplier<select aria-label="Supplier" value={form.supplierId} onChange={(event) => setForm((current) => ({ ...current, supplierId: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3"><option value="">No supplier selected</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.companyName}</option>)}</select></label><label className="text-sm font-semibold">Selling price (INR)<input required type="number" min="0.01" step="0.01" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">MRP (INR)<input type="number" min={form.sellingPrice || "0.01"} step="0.01" value={form.mrp} onChange={event => setForm(current => ({ ...current, mrp: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">HSN code<input inputMode="numeric" pattern="[0-9]{2,8}" maxLength={8} value={form.hsnCode} onChange={event => setForm(current => ({ ...current, hsnCode: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Cost price (INR)<input type="number" min="0" step="0.01" value={form.costPrice} onChange={(event) => setForm((current) => ({ ...current, costPrice: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold">Status<select aria-label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3"><option value="DRAFT">Draft — not published</option><option value="ACTIVE">Active — show on website</option><option value="ARCHIVED">Archived — not published</option></select></label><label className="text-sm font-semibold">{selectedId ? "Available stock" : "Opening stock"}<input type="number" min="0" step="1" disabled={!!selectedId} value={form.availableQty} onChange={(event) => setForm((current) => ({ ...current, availableQty: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3 disabled:bg-[#F7F4ED]" />{selectedId ? <span className="mt-1 block text-xs font-normal text-[#173B35]/60">Existing stock is managed through your inventory integration.</span> : null}</label>{([['gstRate', 'GST (%)', 100], ['handlingCharge', 'Handling charge per unit (INR)', 100000], ['returnDays', 'Return window after delivery (days)', 365]] as const).map(([key,label,max]) => <label key={key} className="text-sm font-semibold">{label}<input type="number" min="0" max={max} step={key === 'returnDays' ? '1' : '0.01'} value={form[key]} onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))} className="mt-2 w-full rounded-xl border px-3 py-3" /></label>)}<label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={!form.isReturnable} onChange={(event) => setForm((current) => ({ ...current, isReturnable: !event.target.checked }))} />This product cannot be returned</label><label className="text-sm font-semibold md:col-span-2">Product description<textarea aria-label="Product description" rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold md:col-span-2">Product specifications<textarea aria-label="Product specifications" rows={5} value={form.specifications} onChange={(event) => setForm((current) => ({ ...current, specifications: event.target.value }))} placeholder="Brand: Walrus&#10;Sleeve: Half Sleeve&#10;Fabric: Polyester" className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><label className="text-sm font-semibold md:col-span-2">Manufacturer info<textarea aria-label="Manufacturer info" rows={4} value={form.manufacturerInfo} onChange={(event) => setForm((current) => ({ ...current, manufacturerInfo: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" /></label><button className="w-fit rounded-xl bg-[#173B35] px-6 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : selectedId ? "Save product" : "Create product"}</button></fieldset>{message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}</form></section>{selected ? <ProductPhotoManager key={selected.id} productId={selected.id} images={selected.imageUrls} onChanged={(imageUrls) => setProducts((current) => current.map((entry) => entry.id === selected.id ? { ...entry, imageUrls } : entry))} /> : <p className="rounded-2xl border border-dashed border-[#173B35]/20 p-6 text-sm text-[#173B35]/70">Create or select a product first, then upload photos for it.</p>}<AdminProductList message={listMessage} products={products} categories={categories} disabled={!ready || busy} onEdit={editFromList} onDelete={removeProduct} /></div>;
}
