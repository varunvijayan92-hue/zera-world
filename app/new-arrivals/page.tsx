import { publicPageMetadata } from "@/lib/seo";
import ProductsPage from "@/app/products/page";
export const dynamic = "force-dynamic";
export const metadata = publicPageMetadata("New Arrivals","Discover the latest products added to Zera's World.","/new-arrivals");
export default async function NewArrivalsPage({ searchParams }: { searchParams?: Promise<{ q?: string; category?: string }> }) {
  const params = searchParams ? await searchParams : {};
  return ProductsPage({ searchParams: Promise.resolve({ ...params, sort: "newest" }) });
}
