"use client";

import { useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { categoryLink, categorySlug, nextCategoryPosition, type MenuCategory } from "@/lib/category";
import { useClientReady } from "./use-client-ready";

const blank = { name: "", slug: "", description: "", isVisible: true };

export function CategoryManager({ initialCategories }: { initialCategories: MenuCategory[] }) {
  const ready = useClientReady();
  const [categories, setCategories] = useState(initialCategories);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function send(url: string, method: string, body?: unknown) {
    const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) throw Error(result.message || "The menu could not be saved.");
    return result;
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await send(editing ? `/api/categories/${editing}` : "/api/categories", editing ? "PATCH" : "POST", { ...form, sortOrder: editing ? categories.find((entry) => entry.id === editing)?.sortOrder || 0 : nextCategoryPosition(categories) });
      setCategories((current) => editing ? current.map((entry) => entry.id === editing ? result.data : entry) : [...current, result.data]);
      setForm(blank); setEditing(null); setMessage("Menu saved. The website now uses the updated category.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Menu could not be saved."); }
    finally { setBusy(false); }
  }
  async function move(index: number, direction: number) {
    const next = [...categories];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    setBusy(true); setMessage("");
    try { await send("/api/categories/reorder", "POST", { ids: next.map((entry) => entry.id) }); setCategories(next.map((entry, sortOrder) => ({ ...entry, sortOrder }))); setMessage("Menu order saved."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Order could not be saved."); }
    finally { setBusy(false); }
  }
  async function remove(category: MenuCategory) {
    if (!window.confirm(`Delete the menu category ${category.name}? Categories with products must be emptied first.`)) return;
    setBusy(true); setMessage("");
    try { await send(`/api/categories/${category.id}`, "DELETE"); setCategories((current) => current.filter((entry) => entry.id !== category.id)); if (editing === category.id) { setEditing(null); setForm(blank); } setMessage("Category deleted."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Category could not be deleted."); }
    finally { setBusy(false); }
  }
  return <div className="mt-7 space-y-6">
    <section className="overflow-hidden rounded-3xl border border-[#173B35]/10 bg-white"><h2 className="px-6 pt-5 text-sm font-semibold">Website menu preview</h2><nav aria-label="Menu preview" className="mt-4 flex flex-wrap gap-2 bg-[#173B35] p-5">{categories.filter((entry) => entry.isVisible).map((category) => <a key={category.id} href={categoryLink(category.slug)} target="_blank" rel="noreferrer" className="rounded-full border border-white/10 bg-white/10 px-4 py-3 text-xs font-extrabold uppercase tracking-wide text-white">{category.name}</a>)}{!categories.some((entry) => entry.isVisible) ? <p className="text-sm text-white/70">Visible categories will appear here.</p> : null}</nav></section>
    {message ? <p role="status" className="rounded-xl border border-[#173B35]/10 bg-white p-4 text-sm">{message}</p> : null}
    <div className="grid items-start gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={save} className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><h2 className="text-xl font-bold">{editing ? "Edit category" : "Create category"}</h2><fieldset disabled={!ready || busy} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Menu name<input required maxLength={80} value={form.name} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, ...(!editing && current.slug === categorySlug(current.name) ? { slug: categorySlug(name) } : {}) })); }} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" placeholder="e.g. Wellness" /></label><label className="block text-sm font-semibold">URL slug<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" placeholder="wellness" /></label><label className="block text-sm font-semibold">Category introduction<textarea maxLength={500} rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full rounded-xl border border-[#173B35]/20 px-3 py-3" placeholder="A short introduction for the category page" /></label><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={form.isVisible} onChange={(event) => setForm((current) => ({ ...current, isVisible: event.target.checked }))} /> Show in website menu</label><p className="text-xs text-[#173B35]/60">Hiding a menu label does not unpublish its products. Product publishing is managed separately.</p><button className="inline-flex items-center gap-2 rounded-xl bg-[#173B35] px-5 py-3 font-semibold text-white disabled:opacity-50"><Plus size={17} />{busy ? "Saving..." : editing ? "Save changes" : "Create menu category"}</button>{editing ? <button type="button" onClick={() => { setEditing(null); setForm(blank); }} className="ml-3 text-sm underline">Cancel</button> : null}</fieldset></form>
      <section className="rounded-3xl border border-[#173B35]/10 bg-white p-6"><h2 className="text-xl font-bold">Menu order</h2><div className="mt-5 space-y-3">{categories.map((category, index) => <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#173B35]/10 p-4"><div><p className="font-bold">{category.name}<span className="ml-2 text-xs font-normal text-[#173B35]/60">{category.isVisible ? "Visible" : "Hidden"}</span></p><p className="mt-1 text-xs text-[#173B35]/60">{category.slug}</p></div><div className="flex items-center gap-2"><button type="button" disabled={!ready || busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${category.name} up`} className="rounded-lg border p-2 disabled:opacity-25"><ArrowUp size={16} /></button><button type="button" disabled={!ready || busy || index === categories.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${category.name} down`} className="rounded-lg border p-2 disabled:opacity-25"><ArrowDown size={16} /></button><button type="button" disabled={!ready || busy} onClick={() => { setEditing(category.id); setForm({ name: category.name, slug: category.slug, description: category.description, isVisible: category.isVisible }); }} aria-label={`Edit ${category.name}`} className="rounded-lg border p-2"><Pencil size={16} /></button><button type="button" disabled={!ready || busy} onClick={() => remove(category)} aria-label={`Delete ${category.name}`} className="rounded-lg border p-2 text-red-700"><Trash2 size={16} /></button></div></div>)}</div></section>
    </div>
  </div>;
}
