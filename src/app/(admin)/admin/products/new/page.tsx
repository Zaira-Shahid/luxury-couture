import type { Metadata } from "next";

import { createProduct } from "@/features/admin-catalog/actions";
import { getActiveCategories } from "@/lib/catalog/get-categories";
import { getMediaLibrary } from "@/lib/media/get-media";

import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Admin — New Product" };

export default async function NewProductPage() {
  const [categories, media] = await Promise.all([getActiveCategories(), getMediaLibrary()]);

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Product</h1>
      <ProductForm categories={categories} media={media} action={createProduct} />
    </div>
  );
}
