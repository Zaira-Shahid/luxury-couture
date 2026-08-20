import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateCollection } from "@/features/admin-catalog/actions";
import { createClient } from "@/lib/supabase/server";
import type { Collection, Product } from "@/types/database";

import { CollectionForm } from "../../collection-form";

export const metadata: Metadata = { title: "Admin — Edit Collection" };

export default async function EditCollectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: collection }, { data: allProducts }, { data: links }, { data: seo }] = await Promise.all([
    supabase.from("collections").select("*").eq("id", id).maybeSingle(),
    supabase.from("products").select("*").order("name"),
    supabase.from("product_collections").select("product_id").eq("collection_id", id),
    supabase
      .from("seo_metadata")
      .select("meta_title, meta_description")
      .eq("entity_type", "collection")
      .eq("entity_id", id)
      .maybeSingle(),
  ]);

  if (!collection) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Collection</h1>
      <CollectionForm
        key={`${collection.id}-${collection.updated_at}`}
        collection={collection as Collection}
        allProducts={(allProducts ?? []) as Product[]}
        selectedProductIds={(links ?? []).map((l) => l.product_id as string)}
        seo={seo ?? undefined}
        action={updateCollection.bind(null, id)}
      />
    </div>
  );
}
