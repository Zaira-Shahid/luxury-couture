"use client";

import { Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteMedia, updateMediaAltText, uploadMedia } from "@/features/media/actions";
import { compressImage } from "@/lib/storage/compress-image";
import { validateImageFile } from "@/lib/storage/validate-file";
import type { Media } from "@/types/database";

export function MediaLibrary({ initialMedia }: { initialMedia: Media[] }) {
  const [media, setMedia] = useState(initialMedia);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUploading] = useTransition();

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const validationError = validateImageFile(file, 10 * 1024 * 1024);
      if (validationError) {
        toast.error(`${file.name}: ${validationError}`);
        continue;
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
        }
      });
    }
  }

  function handleDelete(id: string) {
    startUploading(async () => {
      const result = await deleteMedia(id);
      if ("error" in result) toast.error(result.error);
      else setMedia((prev) => prev.filter((m) => m.id !== id));
    });
  }

  function handleAltTextBlur(id: string, value: string) {
    startUploading(async () => {
      const result = await updateMediaAltText(id, value);
      if ("error" in result) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button type="button" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          {isUploading ? "Uploading…" : "Upload Images"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, or GIF — up to 10MB each</p>
      </div>

      {media.length === 0 ? (
        <p className="text-sm text-muted-foreground">No media uploaded yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-border p-2">
              <div className="group relative aspect-square overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.alt_text ?? ""} className="size-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="absolute top-1 right-1 rounded-md bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <Input
                placeholder="Alt text"
                defaultValue={item.alt_text ?? ""}
                onBlur={(e) => handleAltTextBlur(item.id, e.target.value)}
                className="text-xs"
              />
              {item.size_bytes ? (
                <p className="text-xs text-muted-foreground">{Math.round(item.size_bytes / 1024)} KB</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
