"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-builder-options/actions";
import type { BuilderOptionTable, Colour, Fabric } from "@/types/database";

type OptionRow = Fabric | Colour;

export function BuilderOptionForm({
  table,
  option,
  action,
}: {
  table: BuilderOptionTable;
  option?: OptionRow;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const isColours = table === "colours";

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        toast.success(option ? "Option updated." : "Option created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={option?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={option?.slug} required />
        </div>
      </div>

      {isColours ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hexValue">Hex colour</Label>
          <Input
            id="hexValue"
            name="hexValue"
            placeholder="#A1B2C3"
            defaultValue={(option as Colour | undefined)?.hex_value ?? ""}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={(option as Fabric | undefined)?.description ?? ""}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="imageUrl">Image URL</Label>
        <Input id="imageUrl" name="imageUrl" defaultValue={option?.image_url ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="priceAdjustment">Price adjustment (£)</Label>
          <Input
            id="priceAdjustment"
            name="priceAdjustment"
            type="number"
            step="0.01"
            defaultValue={option?.price_adjustment ?? 0}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={option?.sort_order ?? 0} />
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={option?.is_active ?? true} className="size-4" />
          Active
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : option ? "Save changes" : "Create option"}
      </Button>
    </form>
  );
}
