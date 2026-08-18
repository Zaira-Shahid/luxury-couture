import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/features/admin-catalog/actions";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types/database";

export const metadata: Metadata = { title: "Admin — Products" };

async function getAllProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
  return (data ?? []) as Product[];
}

export default async function AdminProductsPage() {
  const products = await getAllProducts();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Products</h1>
        <Button render={<Link href="/admin/products/new" />}>New Product</Button>
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Featured</th>
                <th className="px-4 py-2 font-medium">Price</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="hover:underline"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{product.status}</td>
                  <td className="px-4 py-2">{product.is_featured ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">
                    {new Intl.NumberFormat("en-GB", {
                      style: "currency",
                      currency: product.currency,
                    }).format(product.base_price)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton
                      action={deleteProduct.bind(null, product.id)}
                      confirmMessage="Delete this product?"
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
