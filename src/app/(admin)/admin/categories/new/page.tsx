import type { Metadata } from "next";

import { createCategory } from "@/features/admin-catalog/actions";

import { CategoryForm } from "../category-form";

export const metadata: Metadata = { title: "Admin — New Category" };

export default function NewCategoryPage() {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Category</h1>
      <CategoryForm action={createCategory} />
    </div>
  );
}
