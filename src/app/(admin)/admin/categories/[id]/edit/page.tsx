import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateCategory } from "@/features/admin-catalog/actions";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

import { CategoryForm } from "../../category-form";

export const metadata: Metadata = { title: "Admin — Edit Category" };

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: category } = await supabase.from("categories").select("*").eq("id", id).maybeSingle();
  if (!category) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Category</h1>
      <CategoryForm
        key={`${category.id}-${category.updated_at}`}
        category={category as Category}
        action={updateCategory.bind(null, id)}
      />
    </div>
  );
}
