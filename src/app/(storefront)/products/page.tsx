import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import { cn } from "@/lib/utils";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { getActiveOccasions } from "@/lib/catalog/get-occasions";
import { getPublishedProducts } from "@/lib/catalog/get-products";
import { buildMetadata } from "@/lib/seo/build-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Shop",
    description:
      "Browse our collection of hand-crafted luxury lehengas, or start your own bespoke piece.",
    // Category filtering is a `?category=` query param, so every filtered
    // view canonicalises back to /products — this stops near-duplicate
    // listings competing with each other in the index.
    path: "/products",
  });
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; occasion?: string }>;
}) {
  const { category, q, occasion } = await searchParams;
  const [products, categories, occasions] = await Promise.all([
    getPublishedProducts({ categorySlug: category, q, occasionSlug: occasion }),
    getActiveCategories(),
    getActiveOccasions(),
  ]);

  return (
    <div className="container py-16">
      <h1 className="mb-6 font-heading text-4xl">Shop</h1>

      {/* Module 23: this search is what makes the `SearchAction` declared
          in the WebSite JSON-LD (Module 20) actually true — that schema
          advertised /products?q= to Google before any search existed. */}
      <form action="/products" method="get" role="search" className="mb-8 flex max-w-md gap-2">
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {occasion ? <input type="hidden" name="occasion" value={occasion} /> : null}
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search pieces…"
          aria-label="Search products"
          className="h-9 flex-1 rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring"
        />
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm text-primary-foreground"
        >
          Search
        </button>
      </form>

      {occasions.length > 0 ? (
        <nav aria-label="Occasion" className="mb-4 flex flex-wrap gap-2 text-sm">
          {occasions.map((occ) => (
            <Link
              key={occ.id}
              href={
                occasion === occ.slug ? "/products" : `/products?occasion=${occ.slug}`
              }
              className={cn(
                "rounded-full border border-border px-3 py-1 transition-colors hover:bg-muted",
                occasion === occ.slug && "bg-foreground text-background hover:bg-foreground"
              )}
            >
              {occ.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {categories.length > 0 ? (
        <nav className="mb-10 flex flex-wrap gap-2 text-sm">
          <Link
            href="/products"
            className={cn(
              "rounded-full border border-border px-3 py-1 transition-colors hover:bg-muted",
              !category && "bg-foreground text-background hover:bg-foreground"
            )}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className={cn(
                "rounded-full border border-border px-3 py-1 transition-colors hover:bg-muted",
                category === cat.slug && "bg-foreground text-background hover:bg-foreground"
              )}
            >
              {cat.name}
            </Link>
          ))}
        </nav>
      ) : null}

      {products.length === 0 ? (
        <p className="text-muted-foreground">
          {q || occasion || category
            ? "Nothing matched that. Try a different search, or start your own design in the custom builder."
            : "No products are published yet — check back soon."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
