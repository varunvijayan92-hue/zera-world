import ProductsPage from "@/app/products/page";
export const dynamic = "force-dynamic";
export const metadata = { title: "New Arrivals", description: "Discover the latest products added to Zera's World." };
export default async function NewArrivalsPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return ProductsPage({ searchParams: Promise.resolve({ ...params, sort: "newest" }) });
}
