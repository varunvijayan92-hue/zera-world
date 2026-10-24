import { ArrowRight, Menu, Search, ShoppingBag, Sparkles, Star, Truck } from "lucide-react";
import Link from "next/link";

import ZeraWorldLogo from "@/components/zera-logo";
import { prisma } from "@/lib/prisma";

const categories = ["Home", "Wellness", "Kitchen", "Travel", "Workspace", "Gift Edit", "New In"];

const categoryBanners = [
  { title: "Home Edit", subtitle: "Warm textures & everyday rituals", badge: "New", image: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80" },
  { title: "Wellness", subtitle: "Calm details for better living", badge: "Best seller", image: "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=900&q=80" },
  { title: "Travel", subtitle: "Smart pieces for moving light", badge: "Trending", image: "https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=900&q=80" },
];

const showcaseCards = [
  { title: "Home Edit", subtitle: "Curated essentials", tag: "New" },
  { title: "Kitchen", subtitle: "Cook smarter", tag: "Hot" },
  { title: "Travel", subtitle: "For every journey", tag: "Trending" },
];

const realisticProductShots = [
  "https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=900&q=80",
];

const featuredProducts = [
  { name: "Luma Ceramic Set", category: "Home Edit", price: "₹2,490" },
  { name: "Iris Textile Tote", category: "Travel", price: "₹1,890" },
  { name: "Saffron Diffuser", category: "Wellness", price: "₹1,420" },
  { name: "Northline Desk Light", category: "Workspace", price: "₹3,640" },
  { name: "Cinder Glass Jar", category: "Kitchen", price: "₹1,160" },
  { name: "Zen Carry Case", category: "Travel", price: "₹2,240" },
  { name: "Luna Throw", category: "Home", price: "₹2,980" },
  { name: "Pilot Notebook", category: "Workspace", price: "₹890" },
];

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const productCards = (products.length > 0 ? products : featuredProducts.map((item, index) => ({
    id: `fallback-${index}`,
    name: item.name,
    category: item.category,
    sku: `${index}-sku`,
    sellingPrice: parseInt(item.price.replace(/[^\d]/g, ""), 10),
    imageUrls: [realisticProductShots[index % realisticProductShots.length]],
  }))) as Array<{
    id: string;
    name: string;
    category?: string | null;
    sellingPrice?: number | string | null;
    imageUrls?: string[];
  }>;

  return (
    <main className="min-h-screen bg-[#040906] px-3 py-4 text-[#173B35] md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1280px] rounded-[26px] bg-[#f5f3ee] shadow-[0_35px_75px_rgba(0,0,0,0.32)] ring-1 ring-white/10">
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

        <div className="tokoo-subnav">
          {categories.map((category) => (
            <a key={category} href="#featured" className="tokoo-subnav-item">{category}</a>
          ))}
        </div>

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
            <div className="tokoo-hero-actions">
              <Link href="/products" className="tokoo-primary-button">
                Shop now
                <ArrowRight size={16} />
              </Link>
              <Link href="/admin/login" className="tokoo-secondary-button">
                ZeraWorld Connect
              </Link>
            </div>
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
            <article key={card.title} className="tokoo-showcase-card">
              <div className="tokoo-showcase-icon">
                <Star size={18} />
              </div>
              <p className="tokoo-showcase-tag">{card.tag}</p>
              <h3>{card.title}</h3>
              <p>{card.subtitle}</p>
            </article>
          ))}
        </section>

        <section className="tokoo-category-strip" aria-label="Product categories">
          {categoryBanners.map((banner) => (
            <article
              key={banner.title}
              className="tokoo-banner-card"
              style={{ backgroundImage: `linear-gradient(135deg, rgba(7,14,13,0.42), rgba(7,14,13,0.36)), url(${banner.image})` }}
            >
              <div className="tokoo-banner-badge">{banner.badge}</div>
              <h3>{banner.title}</h3>
              <p>{banner.subtitle}</p>
            </article>
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
            {productCards.map((product, index) => {
              const imageUrl = product.imageUrls?.[0] || realisticProductShots[index % realisticProductShots.length];
              const price = Number(product.sellingPrice ?? 0);

              return (
                <article key={product.id} className="tokoo-product-card">
                  <div className="tokoo-product-media">
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.name} />
                    ) : (
                      <span>✦</span>
                    )}
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
            <a href="/admin/login">ZeraWorld Connect</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
