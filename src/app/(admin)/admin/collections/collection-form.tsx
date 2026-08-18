"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-catalog/actions";
import type { Collection, Product } from "@/types/database";

export function CollectionForm({
  collection,
  allProducts,
  selectedProductIds,
  seo,
  action,
}: {
  collection?: Collection;
  allProducts: Product[];
  selectedProductIds: string[];
  seo?: { meta_title: string | null; meta_description: string | null };
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
        toast.success(collection ? "Collection updated." : "Collection created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={collection?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={collection?.slug} required />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={3} defaultValue={collection?.description ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="coverImageUrl">Cover image URL</Label>
        <Input id="coverImageUrl" name="coverImageUrl" defaultValue={collection?.cover_image_url ?? ""} />
      </div>

      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isFeatured" defaultChecked={collection?.is_featured ?? false} className="size-4" />
          Featured
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={collection?.is_active ?? true} className="size-4" />
          Active
        </label>
      </div>

      <div>
        <Label className="mb-2">Products in this collection</Label>
        {allProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products exist yet.</p>
        ) : (
          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto rounded-lg border border-border p-3">
            {allProducts.map((product) => (
              <label key={product.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="productIds"
                  value={product.id}
                  defaultChecked={selectedProductIds.includes(product.id)}
                  className="size-4"
                />
                {product.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="metaTitle">Meta title (SEO)</Label>
          <Input id="metaTitle" name="metaTitle" defaultValue={seo?.meta_title ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="metaDescription">Meta description (SEO)</Label>
          <Input id="metaDescription" name="metaDescription" defaultValue={seo?.meta_description ?? ""} />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={isPending} className="w-fit">
        {isPending ? "Saving…" : collection ? "Save changes" : "Create collection"}
      </Button>
    </form>
  );
}
