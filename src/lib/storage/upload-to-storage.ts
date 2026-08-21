import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Uploads a file via the service-role client — storage.objects has no
 * client-writable RLS policy for any of the three buckets (0025, 0039),
 * so every upload goes through here after the caller has already run its
 * own authorization check (token match for guests, is_admin() for the
 * media library, reviews.customer_id = auth.uid() for review photos).
 * Path should already be randomized by the caller; this doesn't add any
 * additional obscurity of its own.
 */
export async function uploadToStorage(
  bucket: "inspiration-images" | "media" | "review-media",
  path: string,
  file: File
): Promise<{ url: string; path: string } | { error: string }> {
  const admin = createAdminClient();
  const { error } = await admin.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) return { error: error.message };

  const {
    data: { publicUrl },
  } = admin.storage.from(bucket).getPublicUrl(path);

  return { url: publicUrl, path };
}

export async function deleteFromStorage(
  bucket: "inspiration-images" | "media" | "review-media",
  path: string
): Promise<void> {
  const admin = createAdminClient();
  await admin.storage.from(bucket).remove([path]);
}

export function randomStoragePath(prefix: string, file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${prefix}/${crypto.randomUUID()}.${ext}`;
}
