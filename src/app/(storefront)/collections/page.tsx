import type { Metadata } from "next";
import Link from "next/link";

import { getActiveCollections } from "@/lib/catalog/get-collections";

export const metadata: Metadata = { title: "Collections" };

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
              <div className="aspect-[4/5] overflow-hidden bg-muted">
                {collection.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={collection.cover_image_url}
                    alt={collection.name}
                    className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
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
