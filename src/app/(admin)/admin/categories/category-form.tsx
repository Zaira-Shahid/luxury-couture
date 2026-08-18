"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-catalog/actions";
import type { Category } from "@/types/database";

export function CategoryForm({
  category,
  action,
}: {
  category?: Category;
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        toast.success(category ? "Category updated." : "Category created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={category?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={category?.slug} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={category?.description ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="imageUrl">Image URL</Label>
        <Input id="imageUrl" name="imageUrl" defaultValue={category?.image_url ?? ""} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortOrder">Sort order</Label>
          <Input id="sortOrder" name="sortOrder" type="number" defaultValue={category?.sort_order ?? 0} />
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={category?.is_active ?? true} className="size-4" />
          Active
        </label>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : category ? "Save changes" : "Create category"}
      </Button>
    </form>
  );
}
