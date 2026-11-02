import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { ProductEditor } from "@/components/product-editor";
import { getMenuCategories } from "@/lib/category-data";
import { readProductExtras } from "@/lib/product-pricing";

export default async function AdminProductsPage({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  await requireStoreAdmin();
  const params = searchParams ? await searchParams : {};
  const query = (params.q || "").trim().slice(0, 100);
  const [products, categories, suppliers] = await Promise.all([
    prisma.product.findMany({ where: query ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] } : {}, include: { inventory: true, supplier: { select: { id: true, companyName: true } } }, orderBy: { createdAt: "desc" }, take: 100 }),
    getMenuCategories(),
    prisma.supplier.findMany({ orderBy: [{ companyName: "asc" }], select: { id: true, companyName: true } }),
  ]);
  const extras = await readProductExtras(products.map(product => product.id));
  return <main className="mx-auto max-w-6xl px-5 py-8"><h1 className="text-3xl font-black tracking-tight">Products & photos</h1><p className="mt-2 text-sm text-[#173B35]/65">Add products, choose their menu category, and upload photos to Cloudinary.</p><form method="get" className="my-6 flex gap-3"><input name="q" defaultValue={query} placeholder="Find product by name or SKU" aria-label="Find product" className="min-w-0 flex-1 rounded-xl border border-[#173B35]/20 bg-white px-4 py-3" /><button className="rounded-xl border border-[#173B35]/20 bg-white px-5 font-semibold">Search</button></form><ProductEditor key={query} initialProducts={products.map((product) => ({ ...extras.get(product.id), id: product.id, name: product.name, sku: product.sku, description: product.description || "", brand: product.brand || "", categoryId: product.categoryId, category: product.category, supplierId: product.supplierId, supplierName: product.supplier?.companyName ?? null, sellingPrice: Number(product.sellingPrice || 0), costPrice: Number(product.costPrice || 0), status: product.status, gstRate: Number(product.gstRate), handlingCharge: Number(product.handlingCharge), returnDays: product.returnDays, isReturnable: product.isReturnable, imageUrls: product.imageUrls, availableQty: product.inventory.reduce((sum, row) => sum + Math.max(0, row.availableQty - row.reservedQty), 0) }))} categories={categories} suppliers={suppliers} /></main>;
}
