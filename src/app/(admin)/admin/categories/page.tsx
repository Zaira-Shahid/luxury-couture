import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteCategory } from "@/features/admin-catalog/actions";
import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

export const metadata: Metadata = { title: "Admin — Categories" };

async function getAllCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []) as Category[];
}

export default async function AdminCategoriesPage() {
  const categories = await getAllCategories();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Categories</h1>
        <Button render={<Link href="/admin/categories/new" />}>New Category</Button>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No categories yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Sort</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/categories/${category.id}/edit`} className="hover:underline">
                      {category.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{category.is_active ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">{category.sort_order}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton
                      action={deleteCategory.bind(null, category.id)}
                      confirmMessage="Delete this category?"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
