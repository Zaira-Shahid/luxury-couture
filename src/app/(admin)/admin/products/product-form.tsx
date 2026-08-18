"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/features/admin-catalog/actions";
import type { Category } from "@/types/database";
import type { ProductWithImages } from "@/lib/catalog/get-products";

type ImageRow = { url: string; altText: string; isPrimary: boolean };

export function ProductForm({
  product,
  categories,
  seo,
  action,
}: {
  product?: ProductWithImages;
  categories: Category[];
  seo?: { meta_title: string | null; meta_description: string | null };
  action: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<ImageRow[]>(
    product?.product_images
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((img) => ({ url: img.url, altText: img.alt_text ?? "", isPrimary: img.is_primary })) ?? []
  );

  function addImageRow() {
    setImages((prev) => [...prev, { url: "", altText: "", isPrimary: prev.length === 0 }]);
  }
  function updateImageRow(index: number, patch: Partial<ImageRow>) {
    setImages((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }
  function removeImageRow(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set(
      "images",
      JSON.stringify(images.filter((row) => row.url.trim()).map((row) => ({ ...row, isPrimary: row.isPrimary })))
    );
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        toast.success(product ? "Product updated." : "Product created.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={product?.name} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" name="slug" defaultValue={product?.slug} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sku">SKU (optional)</Label>
          <Input id="sku" name="sku" defaultValue={product?.sku ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="categoryId">Category</Label>
          <select
            id="categoryId"
            name="categoryId"
            defaultValue={product?.category_id ?? ""}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">No category</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="basePrice">Price</Label>
          <Input
            id="basePrice"
            name="basePrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={product?.base_price ?? 0}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue={product?.currency ?? "GBP"} maxLength={3} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            name="status"
            defaultValue={product?.status ?? "draft"}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={product?.is_featured ?? false}
            className="size-4"
          />
          Featured
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={4} defaultValue={product?.description ?? ""} />
      </div>

      <div>
        <Label className="mb-2">Images (URL)</Label>
        <div className="flex flex-col gap-2">
          {images.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                placeholder="https://…"
                value={row.url}
                onChange={(e) => updateImageRow(i, { url: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Alt text"
                value={row.altText}
                onChange={(e) => updateImageRow(i, { altText: e.target.value })}
                className="w-40"
              />
              <label className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                <input
                  type="radio"
                  name="primaryImage"
                  checked={row.isPrimary}
                  onChange={() =>
                    setImages((prev) => prev.map((r, j) => ({ ...r, isPrimary: j === i })))
                  }
                />
                Primary
              </label>
              <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeImageRow(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addImageRow}>
          Add image
        </Button>
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
        {isPending ? "Saving…" : product ? "Save changes" : "Create product"}
      </Button>
    </form>
  );
}
