"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { uploadMedia } from "@/features/media/actions";
import { compressImage } from "@/lib/storage/compress-image";
import { MAX_MEDIA_BYTES, validateImageFile } from "@/lib/storage/validate-file";
import type { Media } from "@/types/database";

/**
 * Reuses Module 8's media library (upload + browse) as a picker for
 * product images, rather than a new Storage bucket or a duplicated
 * upload path — the exact fast-follow docs/ARCHITECTURE.md's Module 5
 * section flagged. onPick fills in the caller's url/altText fields; the
 * manual URL-paste option in ProductForm stays available alongside this.
 */
export function MediaPicker({
  initialMedia,
  onPick,
}: {
  initialMedia: Media[];
  onPick: (url: string, altText: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [media, setMedia] = useState(initialMedia);
  const [isUploading, startUploading] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    const validationError = validateImageFile(file, MAX_MEDIA_BYTES);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    startUploading(async () => {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.set("file", compressed);
      const result = await uploadMedia(formData);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setMedia((prev) => [result.data, ...prev]);
        onPick(result.data.url, result.data.alt_text ?? "");
        setIsOpen(false);
      }
    });
  }

  return (
    <div>
      <Button type="button" variant="outline" size="sm" onClick={() => setIsOpen(true)}>
        Choose from Media Library
      </Button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setIsOpen(false)} />
          <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-xl bg-background p-4 ring-1 ring-foreground/10">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Media Library</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
                Close
              </Button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-fit"
            >
              {isUploading ? "Uploading…" : "Upload new image"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />

            {media.length === 0 ? (
              <p className="text-sm text-muted-foreground">No media uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onPick(item.url, item.alt_text ?? "");
                      setIsOpen(false);
                    }}
                    className="aspect-square overflow-hidden rounded-lg bg-muted ring-1 ring-transparent transition-all hover:ring-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.alt_text ?? ""} className="size-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
