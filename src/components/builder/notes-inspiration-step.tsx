"use client";

import { Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addInspirationImage, removeInspirationImage } from "@/features/builder/actions";
import type { InspirationImage } from "@/types/database";

export function NotesInspirationStep({
  customNotes,
  onNotesChange,
  configId,
  token,
  images,
  onImagesChange,
}: {
  customNotes: string;
  onNotesChange: (value: string) => void;
  configId: string | null;
  token: string | null;
  images: InspirationImage[];
  onImagesChange: (images: InspirationImage[]) => void;
}) {
  const [url, setUrl] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!configId || !token) {
      toast.error("Save your design first (pick at least one option) before adding inspiration images.");
      return;
    }
    if (!url.trim()) return;
    const formData = new FormData();
    formData.set("url", url);
    startTransition(async () => {
      const result = await addInspirationImage(configId, token, formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        onImagesChange([...images, result.data]);
        setUrl("");
      }
    });
  }

  function handleRemove(imageId: string) {
    if (!token) return;
    startTransition(async () => {
      const result = await removeInspirationImage(imageId, token);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        onImagesChange(images.filter((img) => img.id !== imageId));
      }
    });
  }

  return (
    <div>
      <h2 className="font-heading text-2xl">Notes &amp; Inspiration</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Anything else our design team should know? Add links to inspiration images too.
      </p>

      <div className="mt-6 flex flex-col gap-1.5">
        <Label htmlFor="customNotes">Notes</Label>
        <Textarea
          id="customNotes"
          rows={4}
          value={customNotes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="E.g. I'd like a heavier neckline than shown, and a slightly longer train…"
        />
      </div>

      <div className="mt-6">
        <Label className="mb-2">Inspiration images (URL)</Label>
        <div className="flex gap-2">
          <Input
            placeholder="https://…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1"
          />
          <Button type="button" variant="outline" disabled={isPending} onClick={handleAdd}>
            Add
          </Button>
        </div>
        {images.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt="" className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemove(image.id)}
                  className="absolute top-1 right-1 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Remove image"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
