import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Review, ReviewMedia } from "@/types/database";

export type AdminReview = Review & { review_media: ReviewMedia[]; orders: { order_number: string } | null };

/** Admin-only: every review, unpublished first so the moderation queue is obvious. */
export async function getAdminReviews(): Promise<AdminReview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, review_media(*), orders(order_number)")
    .order("is_published", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load admin reviews", { message: error.message });
    return [];
  }
  return (data ?? []) as unknown as AdminReview[];
}
