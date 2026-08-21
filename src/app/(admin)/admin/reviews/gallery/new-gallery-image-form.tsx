"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { MediaPicker } from "@/components/admin/media-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSocialGalleryImage } from "@/features/admin-social-gallery/actions";
import type { Media } from "@/types/database";

export function NewGalleryImageForm({ media }: { media: Media[] }) {
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState("");

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSocialGalleryImage(formData);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success("Image added.");
        setImageUrl("");
      }
    });
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-4">
      <p className="text-sm font-medium">Add Gallery Image</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="newImageUrl">Image URL</Label>
          <Input
            id="newImageUrl"
            name="imageUrl"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>&nbsp;</Label>
          <MediaPicker initialMedia={media} onPick={(url) => setImageUrl(url)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newCaption">Caption (optional)</Label>
          <Input id="newCaption" name="caption" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newLinkUrl">Link (optional)</Label>
          <Input id="newLinkUrl" name="linkUrl" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="newSortOrder">Sort order</Label>
          <Input id="newSortOrder" name="sortOrder" type="number" defaultValue={0} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isActive" defaultChecked className="size-4" />
        Active
      </label>
      <Button type="submit" size="sm" disabled={isPending} className="w-fit">
        {isPending ? "Adding…" : "Add Image"}
      </Button>
    </form>
  );
}
