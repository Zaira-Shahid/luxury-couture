"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { deleteFromStorage, randomStoragePath, uploadToStorage } from "@/lib/storage/upload-to-storage";
import { MAX_MEDIA_BYTES, validateImageFile } from "@/lib/storage/validate-file";
import type { Media } from "@/types/database";

export type ActionResult<T = undefined> = { error: string } | { success: true; data: T };

export async function uploadMedia(formData: FormData): Promise<ActionResult<Media>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };

  const validationError = validateImageFile(file, MAX_MEDIA_BYTES);
  if (validationError) return { error: validationError };

  const path = randomStoragePath("media", file);
  const uploaded = await uploadToStorage("media", path, file);
  if ("error" in uploaded) {
    logger.error("media upload failed", new Error(uploaded.error));
    return { error: "Could not upload that file. Please try again." };
  }

  // Admin-only RLS (is_admin()) — this insert will fail with a clear RLS
  // error for a non-admin caller, same as every other admin CRUD action.
  const { data, error } = await supabase
    .from("media")
    .insert({
      uploader_id: user.id,
      storage_path: uploaded.path,
      url: uploaded.url,
      file_type: file.type,
      size_bytes: file.size,
      alt_text: (formData.get("altText") as string) || null,
    })
    .select()
    .single();

  if (error || !data) {
    logger.error("media record failed", error);
    await deleteFromStorage("media", uploaded.path);
    return { error: "Could not save that file. Please try again." };
  }

  revalidatePath("/admin/media");
  return { success: true, data: data as Media };
}

export async function deleteMedia(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing, error: fetchErr } = await supabase
    .from("media")
    .select("storage_path")
    .eq("id", id)
    .single();
  if (fetchErr || !existing) return { error: "File not found." };

  const { error } = await supabase.from("media").delete().eq("id", id);
  if (error) {
    logger.error("media delete failed", error, { id });
    return { error: "Could not delete that file. Please try again." };
  }

  await deleteFromStorage("media", existing.storage_path);

  revalidatePath("/admin/media");
  return { success: true, data: undefined };
}

export async function updateMediaAltText(id: string, altText: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("media").update({ alt_text: altText || null }).eq("id", id);

  if (error) {
    logger.error("media alt text update failed", error, { id });
    return { error: "Could not update. Please try again." };
  }

  revalidatePath("/admin/media");
  return { success: true, data: undefined };
}
