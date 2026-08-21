import type { Metadata } from "next";
import Link from "next/link";

import { StorefrontImage } from "@/components/shared/storefront-image";
import { getActiveCollections } from "@/lib/catalog/get-collections";
import { buildMetadata } from "@/lib/seo/build-metadata";

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: "Collections",
    description: "Explore our curated lehenga collections, each designed around an occasion.",
    path: "/collections",
  });
}

export default async function CollectionsPage() {
  const collections = await getActiveCollections();

  return (
    <div className="container py-16">
      <h1 className="mb-10 font-heading text-4xl">Collections</h1>
      {collections.length === 0 ? (
        <p className="text-muted-foreground">No collections are published yet — check back soon.</p>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((collection) => (
            <Link
              key={collection.id}
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
              {collection.description ? (
                <p className="text-sm text-muted-foreground">{collection.description}</p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
