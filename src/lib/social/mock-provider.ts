import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";

import type { InstagramProvider, SocialPost } from "./provider";

/**
 * Reads admin-curated rows from social_gallery_images (0039) rather than
 * fabricating fake API data — genuinely admin-controlled today, and the
 * interface shape (id/imageUrl/caption/permalink) matches what a real
 * Instagram post would look like, so swapping to a real provider later
 * only means implementing this same interface differently.
 */
export class MockInstagramProvider implements InstagramProvider {
  async getRecentPosts(limit: number): Promise<SocialPost[]> {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("social_gallery_images")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(limit);

    if (error) {
      logger.warn("failed to load social gallery images", { message: error.message });
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      imageUrl: row.image_url,
      caption: row.caption,
      permalink: row.link_url,
    }));
  }
}
