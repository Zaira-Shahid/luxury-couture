import type { Metadata } from "next";

import { createCollection } from "@/features/admin-catalog/actions";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

import { CollectionForm } from "../collection-form";

export const metadata: Metadata = { title: "Admin — New Collection" };

export default async function NewCollectionPage() {
  const supabase = await createClient();
  const { data: allProducts } = await supabase.from("products").select("*").order("name");

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Collection</h1>
      <CollectionForm
        allProducts={(allProducts ?? []) as Product[]}
        selectedProductIds={[]}
        action={createCollection}
      />
    </div>
  );
}
