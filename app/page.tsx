import { CategoryCarousel } from "@/components/category-carousel";
import { CategoryMenu } from "@/components/category-menu";
import { ProductImage } from "@/components/product-image";
import { categoryLink } from "@/lib/category";
import { Search, ShoppingBag, Sparkles, Truck } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/prisma";

const categoryBannerImages = [
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=80",
];

export const dynamic = "force-dynamic";

async function getHomeProducts() {
  try {
    const products = await prisma.product.findMany({
      where: { status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return products;
  } catch {
    return [] as Array<{
      id: string;
      name: string;
      category?: string | null;
      sellingPrice?: number | string | null;
      imageUrls?: string[];
    }>;
  }
}

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getHomeProducts(),
    prisma.storeCategory.findMany({ where: { isVisible: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }).catch(() => []),
  ]);
  const categoryBanners = categories.map((category, index) => ({ id: category.id, title: category.name, subtitle: category.description || "Discover your next favorite", image: category.imageUrl || categoryBannerImages[index] || null, href: categoryLink(category.slug) }));

  const productCards = products as Array<{
    id: string;
    name: string;
    category?: string | null;
    sellingPrice?: number | string | null;
    imageUrls?: string[];
  }>;

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-3 py-4 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] rounded-[26px] bg-[#f5f3ee] shadow-[0_35px_75px_rgba(23,59,53,0.12)] ring-1 ring-[#173B35]/5">
        <CategoryMenu categories={categories} />

        <section className="tokoo-hero-wrap">
          <div className="tokoo-hero-card">
            <div className="tokoo-pill">
              <Sparkles size={12} />
              Premium living
            </div>
            <h1>Discover More. Live Better.</h1>
            <p>
              Curated homeware, wellness essentials and everyday upgrades built for a more elevated lifestyle.
            </p>
            <div className="tokoo-micro-meta">
              <span>Curated collections</span>
              <span>Fast dispatch</span>
              <span>Premium service</span>
            </div>
          </div>

          <div className="tokoo-side-card">
            <div className="tokoo-side-top">
              <div>
                <p className="tokoo-label">Search</p>
                <h2>Find your next ritual</h2>
              </div>
              <span className="tokoo-search-icon"><Search size={16} /></span>
            </div>

            <form action="/products" method="get" className="tokoo-search-box">
              <Search size={15} />
              <input name="q" aria-label="Search products" placeholder="Search home, wellness, travel..." />
              <button type="submit" aria-label="Submit product search" className="rounded-lg p-1"><Search size={15} /></button>
            </form>

            <div className="tokoo-highlight-box">
              <div className="tokoo-highlight-head">
                <span>Featured collection</span>
                <em>New</em>
              </div>
              <p className="tokoo-highlight-title">Forest Calm</p>
              <p className="tokoo-highlight-copy">Natural textures and warm accents for slower living.</p>
            </div>
          </div>
        </section>

        <CategoryCarousel categories={categoryBanners} />

        <section id="new-arrivals" className="tokoo-products-section">
          <div className="tokoo-section-head">
            <div>
              <p>New arrivals</p>
              <h2>Designed for everyday rituals</h2>
            </div>
            <Link href="/new-arrivals" className="tokoo-section-link">View all</Link>
          </div>

          <div className="tokoo-product-grid">
            {productCards.map((product) => {
              const imageUrl = product.imageUrls?.[0];
              const price = Number(product.sellingPrice ?? 0);

              return (
                <article key={product.id} className="tokoo-product-card">
                  <div className="tokoo-product-media">
                    <ProductImage src={imageUrl} alt={product.name} width={600} height={600} sizes="(min-width: 1024px) 25vw, 50vw" className="h-full w-full object-cover" />
                  </div>

                  <div className="tokoo-product-meta">
                    <div>
                      <p className="tokoo-product-category">{product.category || "Featured"}</p>
                      <Link href={`/products/${product.id}`} className="tokoo-product-name">
                        {product.name}
                      </Link>
                    </div>
                    <Link href={`/products/${product.id}`} className="tokoo-mini-cart" aria-label={`View ${product.name}`}>
                      <ShoppingBag size={16} />
                    </Link>
                  </div>

                  <div className="tokoo-price-row">
                    <span>₹{price.toLocaleString("en-IN")}</span>
                    <span className="tokoo-shipping-tag">
                      <Truck size={12} />
                      Ready to ship
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
