import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { SocialGalleryImage } from "@/types/database";

export async function getAdminSocialGalleryImages(): Promise<SocialGalleryImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_gallery_images")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load social gallery images", { message: error.message });
    return [];
  }
  return (data ?? []) as SocialGalleryImage[];
}
