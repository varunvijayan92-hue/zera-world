import { CategoryCarousel } from "@/components/category-carousel";
import { ProductImage } from "@/components/product-image";
import { categoryLink } from "@/lib/category";
import { ArrowRight, ShieldCheck, ShoppingBag, Sparkles, Truck } from "lucide-react";
import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { getMenuCategories } from "@/lib/category-data";
import { siteUrl } from "@/lib/seo";
import { readProductExtras } from "@/lib/product-pricing";
import { ProductPrice } from "@/components/product-price";

export const metadata = { alternates: { canonical: siteUrl("/") } };

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
      size?: string | null;
      sellingPrice?: number | string | null; gstRate?: number | string | null; handlingCharge?: number | string | null;
      imageUrls?: string[];
    }>;
  }
}

export default async function HomePage() {
  const [products, categories] = await Promise.all([
    getHomeProducts(),
    getMenuCategories().then(categories => categories.filter(category => category.isVisible && !category.parentId)).catch(() => []),
  ]);
  const categoryBanners = categories.map((category, index) => ({ id: category.id, title: category.name, subtitle: category.description || "Discover your next favorite", image: category.imageUrl || categoryBannerImages[index] || null, href: categoryLink(category.slug) }));
  const extras = await readProductExtras(products.map(product => product.id));

  const productCards = products as Array<{
    id: string;
    name: string;
    category?: string | null;
    size?: string | null;
    sellingPrice?: number | string | null; gstRate?: number | string | null; handlingCharge?: number | string | null;
    imageUrls?: string[];
  }>;

  return (
    <main className="min-h-screen bg-[#F7F4ED] px-3 py-4 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] rounded-[26px] bg-[#f5f3ee] shadow-[0_35px_75px_rgba(23,59,53,0.12)] ring-1 ring-[#173B35]/5">
        <section className="tokoo-hero-wrap">
          <div className="tokoo-hero-card premium-living-hero">
            <div className="premium-living-photo" aria-hidden="true" />
            <svg className="premium-living-divider" viewBox="0 0 1000 240" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path className="premium-living-divider-fill" d="M0 0H1000C975 44 935 79 860 112C785 145 708 173 682 240H0Z" />
              <path className="premium-living-divider-line" d="M1000 0C975 44 935 79 860 112C785 145 708 173 682 240" />
              <path className="premium-living-divider-swoosh" d="M784 47C838 33 924 58 988 13" />
              <g className="premium-living-leaf" transform="translate(843 76)">
                <path d="M0 30C10 18 17 10 29 0M12 18C3 17 1 11 4 3C11 5 15 10 12 18ZM18 13C17 4 22 -1 31 -3C31 5 26 11 18 13Z" />
              </g>
            </svg>
            <svg className="premium-living-divider-mobile" viewBox="0 0 400 32" preserveAspectRatio="none" aria-hidden="true" focusable="false">
              <path d="M0 13C100 27 180 0 275 12S360 22 400 8V32H0Z" fill="#103c2f" />
              <path d="M0 13C100 27 180 0 275 12S360 22 400 8" fill="none" stroke="#d8ad54" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              <path d="M315 10C320 5 326 2 334 2C332 9 326 12 320 11M320 11L316 15" fill="#d8ad54" stroke="#d8ad54" strokeWidth="1" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="premium-living-copy">
            <div className="tokoo-pill">
              <Sparkles size={12} />
              Premium living
            </div>
            <h1>Discover More. Live Better.</h1>
            <p>
              Curated homeware, kitchen essentials, travel accessories, and everyday upgrades designed for a better lifestyle.
            </p>
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/products" className="inline-flex items-center gap-3 rounded-full bg-[#EDBD57] px-6 py-3 font-bold text-[#10392D]">Shop now <ArrowRight size={18} /></Link><Link href="/categories" className="rounded-full border border-white/70 px-6 py-3 font-semibold">Explore collections</Link></div>
            <div className="tokoo-micro-meta">
              <span className="flex items-center gap-2"><Sparkles size={18} /> Premium quality</span>
              <span className="flex items-center gap-2"><Truck size={18} /> Reliable delivery</span>
              <span className="flex items-center gap-2"><ShieldCheck size={18} /> Secure payments</span>
            </div>
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
                      {product.category?.trim() ? <p className="tokoo-product-category">{product.category}</p> : null}
                      <Link href={`/products/${product.id}`} className="tokoo-product-name">
                        {product.name}
                      </Link>
                      {product.size?.trim() ? <p className="mt-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] text-[#173B35]/60">Size: {product.size.trim()}</p> : null}
                    </div>
                    <Link href={`/products/${product.id}`} className="tokoo-mini-cart" aria-label={`View ${product.name}`}>
                      <ShoppingBag size={16} />
                    </Link>
                  </div>

                  <div className="tokoo-price-row">
                    <ProductPrice sellingPrice={price} gstRate={product.gstRate == null ? null : Number(product.gstRate)} handlingCharge={Number(product.handlingCharge || 0)} mrp={extras.get(product.id)?.mrp} />
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
