import { CategoryMenu } from "@/components/category-menu";
import { ProductImage } from "@/components/product-image";
import { categoryLink } from "@/lib/category";
import { ArrowRight, Menu, Search, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import Link from "next/link";

import ZeraWorldLogo from "@/components/zera-logo";
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
  const showcaseCards = categories.slice(0, 3).map((category) => ({ title: category.name, subtitle: category.description || "Explore the collection", tag: "Shop collection", href: categoryLink(category.slug) }));
  const categoryBanners = categories.slice(0, 3).map((category, index) => ({ title: category.name, subtitle: category.description || "Discover your next favorite", badge: "Collection", image: categoryBannerImages[index], href: categoryLink(category.slug) }));

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
        <header className="tokoo-header">
          <div className="tokoo-brand">
            <ZeraWorldLogo compact />
          </div>

          <nav className="tokoo-nav">
            <Link href="/">Home</Link>
            <Link href="/products">Shop</Link>
            <a href="#collections">Collections</a>
            <a href="#featured">Featured</a>
            <a href="#journal">Journal</a>
            <a href="#about">About</a>
          </nav>

          <div className="tokoo-actions">
            <button className="tokoo-ghost-button hidden md:inline-flex">
              <Search size={15} />
              Search
            </button>
            <Link href="/login" className="tokoo-ghost-button">Login</Link>
            <Link href="/cart" className="tokoo-cart-button">
              <ShoppingBag size={16} />
              Cart
            </Link>
            <button className="tokoo-menu-button md:hidden" aria-label="Open menu">
              <Menu size={16} />
            </button>
          </div>
        </header>

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

            <label className="tokoo-search-box">
              <Search size={15} />
              <input aria-label="Search products" placeholder="Search home, wellness, travel..." />
            </label>

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

        <section id="collections" className="tokoo-showcase-grid">
          {showcaseCards.map((card) => (
            <Link key={card.title} href={card.href} className="tokoo-showcase-card">
              <div className="tokoo-showcase-icon">
                <Star size={18} />
              </div>
              <p className="tokoo-showcase-tag">{card.tag}</p>
              <h3>{card.title}</h3>
              <p>{card.subtitle}</p>
            </Link>
          ))}
        </section>

        <section className="tokoo-category-strip" aria-label="Product categories">
          {categoryBanners.map((banner) => (
            <Link
              href={banner.href}
              key={banner.title}
              className="tokoo-banner-card"
              style={{ backgroundImage: `linear-gradient(135deg, rgba(7,14,13,0.42), rgba(7,14,13,0.36)), url(${banner.image})` }}
            >
              <div className="tokoo-banner-badge">{banner.badge}</div>
              <h3>{banner.title}</h3>
              <p>{banner.subtitle}</p>
            </Link>
          ))}
        </section>

        <section id="featured" className="tokoo-products-section">
          <div className="tokoo-section-head">
            <div>
              <p>Featured products</p>
              <h2>Designed for everyday rituals</h2>
            </div>
            <Link href="/products" className="tokoo-section-link">View all</Link>
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

        <section id="journal" className="tokoo-journal">
          <div>
            <p className="tokoo-journal-kicker">ZeraWorld Journal</p>
            <h2>Thoughtful living, beautifully organized.</h2>
          </div>
          <Link href="#about" className="tokoo-journal-link">
            Explore the story
            <ArrowRight size={16} />
          </Link>
        </section>

        <footer id="about" className="tokoo-footer">
          <ZeraWorldLogo variant="dark" compact />
          <div className="tokoo-footer-links">
            <a href="#collections">Collections</a>
            <a href="#featured">Featured</a>
            <a href="/login">Customer account</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
