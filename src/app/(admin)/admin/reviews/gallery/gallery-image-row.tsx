"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSocialGalleryImage, updateSocialGalleryImage } from "@/features/admin-social-gallery/actions";
import type { SocialGalleryImage } from "@/types/database";

export function GalleryImageRow({ image }: { image: SocialGalleryImage }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSocialGalleryImage(image.id, formData);
      if ("error" in result) toast.error(result.error);
      else toast.success("Saved.");
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSocialGalleryImage(image.id);
      if ("error" in result) toast.error(result.error);
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-end">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.image_url} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
      <div className="grid flex-1 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={`imageUrl-${image.id}`}>Image URL</Label>
          <Input id={`imageUrl-${image.id}`} name="imageUrl" defaultValue={image.image_url} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`caption-${image.id}`}>Caption</Label>
          <Input id={`caption-${image.id}`} name="caption" defaultValue={image.caption ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`linkUrl-${image.id}`}>Link (optional)</Label>
          <Input id={`linkUrl-${image.id}`} name="linkUrl" defaultValue={image.link_url ?? ""} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`sortOrder-${image.id}`}>Sort</Label>
          <Input id={`sortOrder-${image.id}`} name="sortOrder" type="number" defaultValue={image.sort_order} />
        </div>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={image.is_active} className="size-4" />
          Active
        </label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          Save
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={isPending} onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </form>
  );
}
