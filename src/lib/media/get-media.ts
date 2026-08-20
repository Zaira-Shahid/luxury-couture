import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Media } from "@/types/database";

export async function getMediaLibrary(): Promise<Media[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("media").select("*").order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load media library", { message: error.message });
    return [];
  }
  return (data ?? []) as Media[];
}
