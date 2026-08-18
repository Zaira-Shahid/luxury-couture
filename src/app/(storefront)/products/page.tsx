import type { Metadata } from "next";
import Link from "next/link";

import { ProductCard } from "@/components/storefront/product-card";
import { cn } from "@/lib/utils";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { getPublishedProducts } from "@/lib/catalog/get-products";

export const metadata: Metadata = { title: "Shop" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const [products, categories] = await Promise.all([
    getPublishedProducts(category),
    getActiveCategories(),
  ]);

  return (
    <div className="container py-16">
      <h1 className="mb-6 font-heading text-4xl">Shop</h1>

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
        <p className="text-muted-foreground">No products are published yet — check back soon.</p>
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
