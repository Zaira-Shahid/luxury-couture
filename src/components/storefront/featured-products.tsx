import Link from "next/link";

import { StorefrontImage } from "@/components/shared/storefront-image";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getFeaturedProducts } from "@/lib/catalog/get-featured";

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(amount);
}

export async function FeaturedProducts() {
  const products = await getFeaturedProducts();
  if (products.length === 0) return null;

  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-10 text-center font-heading text-3xl sm:text-4xl">Featured Pieces</h2>
      </ScrollReveal>
      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product, i) => (
          <ScrollReveal key={product.id} delay={i * 0.05}>
            <Link href={`/products/${product.slug}`} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-muted">
                {product.image_url ? (
                  <StorefrontImage
                    src={product.image_url}
                    alt={product.name}
                    sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full bg-gradient-to-br from-secondary to-muted" />
                )}
              </div>
              <p className="mt-3 text-sm">{product.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatPrice(product.base_price, product.currency)}
              </p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
