import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { updateInventoryItem } from "@/features/admin-inventory/actions";
import { getAdminOptionRows } from "@/lib/admin/get-builder-options";
import { getAdminInventoryItem } from "@/lib/admin/get-inventory";
import type { Fabric } from "@/types/database";

import { InventoryForm } from "../../inventory-form";

export const metadata: Metadata = { title: "Edit Inventory Item" };

export default async function EditInventoryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, fabrics] = await Promise.all([getAdminInventoryItem(id), getAdminOptionRows<Fabric>("fabrics")]);
  if (!item) notFound();

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">Edit Inventory Item</h1>
      <InventoryForm
        key={`${item.id}-${item.updated_at}`}
        item={item}
        fabrics={fabrics}
        action={updateInventoryItem.bind(null, id)}
      />
    </div>
  );
}
