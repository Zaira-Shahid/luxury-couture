import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteCollection } from "@/features/admin-catalog/actions";
import { getAdminCollections } from "@/lib/catalog/get-admin-catalog";

export const metadata: Metadata = { title: "Admin — Collections" };

export default async function AdminCollectionsPage() {
  const collections = await getAdminCollections();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Collections</h1>
        <Button render={<Link href="/admin/collections/new" />}>New Collection</Button>
      </div>

      {collections.length === 0 ? (
        <p className="text-sm text-muted-foreground">No collections yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Active</th>
                <th className="px-4 py-2 font-medium">Featured</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/admin/collections/${collection.id}/edit`} className="hover:underline">
                      {collection.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{collection.is_active ? "Yes" : "—"}</td>
                  <td className="px-4 py-2">{collection.is_featured ? "Yes" : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <DeleteButton
                      action={deleteCollection.bind(null, collection.id)}
                      confirmMessage="Delete this collection?"
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
