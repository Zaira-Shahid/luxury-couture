"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-inventory/actions";
import type { Fabric, InventoryItem } from "@/types/database";

export function InventoryForm({
  item,
  fabrics,
  action,
}: {
  item?: InventoryItem;
  fabrics: Fabric[];
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState(item?.category ?? "fabric");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        toast.success(item ? "Inventory item updated." : "Inventory item created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="category">Category</Label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="fabric">Fabric</option>
            <option value="material">Material</option>
            <option value="embroidery_material">Embroidery material</option>
          </select>
        </div>
        {category === "fabric" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="fabricId">Linked fabric (optional)</Label>
            <select
              id="fabricId"
              name="fabricId"
              defaultValue={item?.fabric_id ?? ""}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Not linked</option>
              {fabrics.map((fabric) => (
                <option key={fabric.id} value={fabric.id}>
                  {fabric.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={item?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sku">SKU (optional)</Label>
          <Input id="sku" name="sku" defaultValue={item?.sku ?? ""} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" placeholder="meters" defaultValue={item?.unit ?? "meters"} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="stockQuantity">Stock</Label>
          <Input
            id="stockQuantity"
            name="stockQuantity"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.stock_quantity ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reservedQuantity">Reserved</Label>
          <Input
            id="reservedQuantity"
            name="reservedQuantity"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.reserved_quantity ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lowStockThreshold">Low stock at</Label>
          <Input
            id="lowStockThreshold"
            name="lowStockThreshold"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.low_stock_threshold ?? 0}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isAvailable" defaultChecked={item?.is_available ?? true} className="size-4" />
        Available
      </label>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea id="notes" name="notes" rows={3} defaultValue={item?.notes ?? ""} />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : item ? "Save changes" : "Create item"}
      </Button>
    </form>
  );
}
