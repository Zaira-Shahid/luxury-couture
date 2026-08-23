"use client";

import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addInspirationImage, removeInspirationImage } from "@/features/builder/actions";
import { compressImage } from "@/lib/storage/compress-image";
import { validateImageFile } from "@/lib/storage/validate-file";
import { cn } from "@/lib/utils";
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, startUploading] = useTransition();
  const [isRemoving, startRemoving] = useTransition();

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    if (!configId || !token) {
      toast.error("Save your design first (pick at least one option) before adding inspiration images.");
      return;
    }
    const validationError = validateImageFile(file);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    startUploading(async () => {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.set("file", compressed);
      const result = await addInspirationImage(configId, token, formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        onImagesChange([...images, result.data]);
      }
    });
  }

  function handleRemove(imageId: string) {
    if (!token) return;
    startRemoving(async () => {
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
        Anything else our design team should know? Upload inspiration images too.
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
        <Label className="mb-2">Inspiration images</Label>
        <div
          role="button"
          tabIndex={0}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground transition-colors",
            isDragging ? "border-primary bg-secondary/50" : "border-border hover:border-foreground/30"
          )}
        >
          <ImageUp className="size-6" strokeWidth={1.5} />
          <p>{isUploading ? "Uploading…" : "Drag an image here, or click to choose one"}</p>
          <p className="text-xs">JPEG, PNG, WebP, or GIF — up to 5MB</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {images.length > 0 ? (
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {images.map((image, index) => (
              <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                {/*
                  MODULE 28: alt was "". These are the customer's OWN
                  uploads sitting next to a remove button, so a screen
                  reader announcing nothing left no way to tell which
                  image was about to be deleted. Decorative is the wrong
                  call whenever an image is the subject of a control.

                  Stays a plain <img>: these are freshly uploaded URLs
                  rendered in a form preview, not catalogue content, and
                  next/image would buy nothing here.
                */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.url}
                  alt={`Inspiration image ${index + 1}`}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
                <button
                  type="button"
                  disabled={isRemoving}
                  onClick={() => handleRemove(image.id)}
                  aria-label={`Remove inspiration image ${index + 1}`}
                  // MODULE 28: `opacity-0` + `group-hover:opacity-100`
                  // alone made this button INVISIBLE to a keyboard user
                  // even while focused — a WCAG 2.4.7 failure, not a
                  // styling nicety. group-focus-within reveals it when
                  // focus lands anywhere in the tile.
                  className="absolute top-1 right-1 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"
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
