import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Review, ReviewMedia } from "@/types/database";

export type ReviewWithMedia = Review & { review_media: ReviewMedia[] };

export const getProductReviews = cache(async (productId: string): Promise<ReviewWithMedia[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, review_media(*)")
    .eq("product_id", productId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load product reviews", { productId, message: error.message });
    return [];
  }
  return (data ?? []) as unknown as ReviewWithMedia[];
});

export type RatingSummary = { average: number; count: number };

export const getProductRatingSummary = cache(async (productId: string): Promise<RatingSummary> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("rating")
    .eq("product_id", productId)
    .eq("is_published", true);

  if (error) {
    logger.warn("failed to load product rating summary", { productId, message: error.message });
    return { average: 0, count: 0 };
  }
  const ratings = (data ?? []).map((r) => r.rating as number);
  if (ratings.length === 0) return { average: 0, count: 0 };
  return { average: ratings.reduce((sum, r) => sum + r, 0) / ratings.length, count: ratings.length };
});
