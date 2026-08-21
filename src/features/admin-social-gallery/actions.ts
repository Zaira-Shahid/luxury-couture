"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";
import { socialGalleryImageSchema } from "@/lib/validations/social-gallery";

export type ActionResult = { error: string } | { success: true };

function parseFormData(formData: FormData) {
  return socialGalleryImageSchema.safeParse({
    imageUrl: formData.get("imageUrl"),
    caption: formData.get("caption") ?? "",
    linkUrl: formData.get("linkUrl") ?? "",
    sortOrder: formData.get("sortOrder") || 0,
    isActive: formData.get("isActive") === "on",
  });
}

export async function createSocialGalleryImage(formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase.from("social_gallery_images").insert({
    image_url: parsed.data.imageUrl,
    caption: parsed.data.caption || null,
    link_url: parsed.data.linkUrl || null,
    sort_order: parsed.data.sortOrder,
    is_active: parsed.data.isActive,
  });
  if (error) {
    logger.error("social gallery image creation failed", error);
    return { error: "Could not add this image. Please try again." };
  }

  revalidatePath("/admin/reviews/gallery");
  return { success: true };
}

export async function updateSocialGalleryImage(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseFormData(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("social_gallery_images")
    .update({
      image_url: parsed.data.imageUrl,
      caption: parsed.data.caption || null,
      link_url: parsed.data.linkUrl || null,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", id);
  if (error) {
    logger.error("social gallery image update failed", error, { id });
    return { error: "Could not update this image. Please try again." };
  }

  revalidatePath("/admin/reviews/gallery");
  return { success: true };
}

export async function deleteSocialGalleryImage(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("social_gallery_images").delete().eq("id", id);
  if (error) {
    logger.error("social gallery image delete failed", error, { id });
    return { error: "Could not delete this image. Please try again." };
  }

  revalidatePath("/admin/reviews/gallery");
  return { success: true };
}
