import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductCard } from "@/components/storefront/product-card";
import { getCollectionBySlug, getCollectionProducts } from "@/lib/catalog/get-collections";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  return { title: collection?.name ?? "Collection" };
}

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();

  const products = await getCollectionProducts(collection.id);

  return (
    <div className="container py-16">
      <h1 className="font-heading text-4xl">{collection.name}</h1>
      {collection.description ? (
        <p className="mt-3 max-w-2xl text-muted-foreground">{collection.description}</p>
      ) : null}

      <div className="mt-10">
        {products.length === 0 ? (
          <p className="text-muted-foreground">No products in this collection yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
