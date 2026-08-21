import type { Metadata } from "next";
import Link from "next/link";

import { DeleteButton } from "@/components/admin/delete-button";
import { Button } from "@/components/ui/button";
import { deleteInventoryItem } from "@/features/admin-inventory/actions";
import { getAdminInventoryItems } from "@/lib/admin/get-inventory";

export const metadata: Metadata = { title: "Inventory" };

const CATEGORY_LABELS: Record<string, string> = {
  fabric: "Fabric",
  material: "Material",
  embroidery_material: "Embroidery material",
};

export default async function AdminInventoryPage() {
  const items = await getAdminInventoryItems();

  return (
    <div className="container py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-heading text-2xl">Inventory</h1>
        <Button render={<Link href="/admin/inventory/new" />}>New Item</Button>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No inventory items yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Available</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const available = Number(item.stock_quantity) - Number(item.reserved_quantity);
                const isLowStock = available <= Number(item.low_stock_threshold);
                return (
                  <tr key={item.id} className="border-t border-border">
                    <td className="px-4 py-2">
                      <Link href={`/admin/inventory/${item.id}/edit`} className="hover:underline">
                        {item.name}
                      </Link>
                      {item.sku ? <span className="ml-2 text-xs text-muted-foreground">{item.sku}</span> : null}
                    </td>
                    <td className="px-4 py-2">{CATEGORY_LABELS[item.category] ?? item.category}</td>
                    <td className="px-4 py-2">
                      {available} {item.unit}
                    </td>
                    <td className="px-4 py-2">
                      {!item.is_available ? (
                        <span className="text-muted-foreground">Unavailable</span>
                      ) : isLowStock ? (
                        <span className="font-medium text-destructive">Low stock</span>
                      ) : (
                        <span className="text-muted-foreground">In stock</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <DeleteButton
                        action={deleteInventoryItem.bind(null, item.id)}
                        confirmMessage="Delete this item?"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
