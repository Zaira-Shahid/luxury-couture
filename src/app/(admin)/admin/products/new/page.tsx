import type { Metadata } from "next";

import { createProduct } from "@/features/admin-catalog/actions";
import { getActiveCategories } from "@/lib/catalog/get-categories";

import { ProductForm } from "../product-form";

export const metadata: Metadata = { title: "Admin — New Product" };

export default async function NewProductPage() {
  const categories = await getActiveCategories();

  return (
    <div className="container max-w-3xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Product</h1>
      <ProductForm categories={categories} action={createProduct} />
    </div>
  );
}
