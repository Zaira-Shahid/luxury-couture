import type { Metadata } from "next";

import { createInventoryItem } from "@/features/admin-inventory/actions";
import { getAdminOptionRows } from "@/lib/admin/get-builder-options";
import type { Fabric } from "@/types/database";

import { InventoryForm } from "../inventory-form";

export const metadata: Metadata = { title: "New Inventory Item" };

export default async function NewInventoryItemPage() {
  const fabrics = await getAdminOptionRows<Fabric>("fabrics");

  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 font-heading text-2xl">New Inventory Item</h1>
      <InventoryForm fabrics={fabrics} action={createInventoryItem} />
    </div>
  );
}
