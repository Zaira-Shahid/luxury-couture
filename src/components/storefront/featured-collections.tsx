import Link from "next/link";

import { StorefrontImage } from "@/components/shared/storefront-image";
import { ScrollReveal } from "@/components/motion/scroll-reveal";
import { getFeaturedCollections } from "@/lib/catalog/get-featured";

export async function FeaturedCollections() {
  const collections = await getFeaturedCollections();
  if (collections.length === 0) return null;

  return (
    <section className="container py-20">
      <ScrollReveal>
        <h2 className="mb-10 text-center font-heading text-3xl sm:text-4xl">
          Featured Collections
        </h2>
      </ScrollReveal>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((collection, i) => (
          <ScrollReveal key={collection.id} delay={i * 0.05}>
            <Link
              href={`/collections/${collection.slug}`}
              className="group block overflow-hidden rounded-xl"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                {collection.cover_image_url ? (
                  <StorefrontImage
                    src={collection.cover_image_url}
                    alt={collection.name}
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full bg-gradient-to-br from-secondary to-muted" />
                )}
              </div>
              <p className="mt-3 font-heading text-lg">{collection.name}</p>
            </Link>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
