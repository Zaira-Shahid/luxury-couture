// Mirrors the bucket-level limits set in supabase/migrations/0025 — those
// are the real, server-enforced floor; this is for immediate client-side
// feedback before even attempting an upload.
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB, matches inspiration-images bucket
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024; // 10MB, matches media bucket

export function validateImageFile(
  file: File,
  maxBytes: number = MAX_IMAGE_BYTES
): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return "Please upload a JPEG, PNG, WebP, or GIF image.";
  }
  if (file.size > maxBytes) {
    return `That file is too large — please upload something under ${Math.round(maxBytes / 1024 / 1024)}MB.`;
  }
  return null;
}
