"use client";

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

/**
 * Client-side resize/re-encode via Canvas — no server-side image
 * processing dependency, "where practical" for this stack. GIFs pass
 * through untouched (canvas re-encoding would flatten animation). PNGs
 * stay PNG (preserve transparency); JPEG/WebP re-encode as JPEG at a
 * reduced quality. Falls back to the original file on any failure —
 * compression is a nice-to-have, never a blocker for a real upload.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));

    if (scale === 1 && file.size < 400 * 1024) {
      // Already small enough — not worth the quality loss of re-encoding.
      bitmap.close();
      return file;
    }

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputType, outputType === "image/jpeg" ? JPEG_QUALITY : undefined)
    );
    if (!blob) return file;

    const ext = outputType === "image/png" ? "png" : "jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + `.${ext}`;
    return new File([blob], name, { type: outputType });
  } catch {
    return file;
  }
}
