import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, ShoppingBag, Truck } from "lucide-react";

import { CartButton } from "@/components/cart-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { supplier: true },
  });

  if (!product) {
    notFound();
  }

  const gallery = product.imageUrls?.length ? product.imageUrls : ["https://images.unsplash.com/..." ];

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-4 py-8 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/products" className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#173B35]/15 bg-white px-4 py-2 text-sm font-semibold text-[#173B35]">
          <ArrowLeft size={16} />
          Back to products
        </Link>

        <div className="grid gap-8 rounded-[32px] border border-[#173B35]/10 bg-white p-5 shadow-[0_18px_48px_rgba(23,59,53,0.06)] lg:grid-cols-[1.1fr_0.9fr] lg:p-8">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[28px] border border-[#173B35]/10 bg-[#F7F4ED]">
              <img src={gallery[0]} alt={product.name} className="h-[420px] w-full object-cover" />
            </div>

            {gallery.length > 1 ? (
              <div className="grid grid-cols-3 gap-3">
                {gallery.slice(0, 3).map((image, index) => (
                  <div key={`${product.id}-${index}`} className="overflow-hidden rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED]">
                    <img src={image} alt={`${product.name} ${index + 1}`} className="h-28 w-full object-cover" />
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#173B35]/60">{product.category || "Featured product"}</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.07em] text-[#173B35]">{product.name}</h1>

            <div className="mt-4 flex items-center gap-3 text-sm text-[#173B35]/70">
              <span className="rounded-full bg-[#B38A45]/10 px-2.5 py-1 font-medium text-[#173B35]">SKU: {product.sku}</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 font-medium text-emerald-700">
                <ShieldCheck size={14} />
                Verified supplier
              </span>
            </div>

            <p className="mt-5 text-3xl font-black text-[#173B35]">₹{Number(product.sellingPrice ?? 0).toLocaleString("en-IN")}</p>

            <div className="mt-6 space-y-3 text-sm text-[#173B35]/75">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-[#173B35]" />
                <span>Fast dispatch and marketplace-ready shipping</span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-[#173B35]" />
                <span>Supplier: {product.supplier?.companyName || "ZeraWorld Marketplace"}</span>
              </div>
            </div>

            <div className="mt-6">
              <CartButton product={{
                id: product.id,
                name: product.name,
                sku: product.sku,
                sellingPrice: Number(product.sellingPrice ?? 0),
                imageUrls: product.imageUrls,
              }} />
            </div>

            <div className="mt-8 rounded-2xl border border-[#173B35]/10 bg-[#F7F4ED] p-4 text-sm text-[#173B35]/75">
              <p className="font-semibold text-[#173B35]">Product overview</p>
              <p className="mt-2 leading-6">
                {product.description || "Premium quality product curated for ZeraWorld customers and synced to sales channel inventory flows."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
