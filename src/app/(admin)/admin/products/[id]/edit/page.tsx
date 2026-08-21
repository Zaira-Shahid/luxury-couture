import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateProduct } from "@/features/admin-catalog/actions";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { getMediaLibrary } from "@/lib/media/get-media";
import { createClient } from "@/lib/supabase/server";
import type { ProductWithImages } from "@/lib/catalog/get-products";

import { ProductForm } from "../../product-form";

export const metadata: Metadata = { title: "Admin — Edit Product" };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: seo }, categories, media] = await Promise.all([
    supabase.from("products").select("*, product_images(*)").eq("id", id).maybeSingle(),
    supabase
      .from("seo_metadata")
      .select("meta_title, meta_description")
      .eq("entity_type", "product")
      .eq("entity_id", id)
      .maybeSingle(),
    getActiveCategories(),
    getMediaLibrary(),
  ]);

  if (!product) notFound();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Product</h1>
      <ProductForm
        key={`${product.id}-${product.updated_at}`}
        product={product as ProductWithImages}
        categories={categories}
        media={media}
        seo={seo ?? undefined}
        action={updateProduct.bind(null, id)}
      />
    </div>
  );
}
