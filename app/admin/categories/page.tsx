import { requireStoreAdmin } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { CategoryManager } from "@/components/category-manager";

export default async function AdminCategoriesPage() {
  await requireStoreAdmin();
  const categories = await prisma.storeCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return <main className="mx-auto max-w-6xl px-5 py-8"><h1 className="text-3xl font-black tracking-tight">Menu categories</h1><p className="mt-2 text-sm text-[#173B35]/65">Create the menu labels customers see, choose their order, and assign products from Products & photos.</p><CategoryManager initialCategories={categories} /></main>;
}
