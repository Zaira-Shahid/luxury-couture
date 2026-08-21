"use server";

import { revalidatePath } from "next/cache";

import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

/**
 * reviews has no delete policy for anyone, even admin (0009) — every
 * other admin-deletable table in this project has one, so its absence
 * reads as deliberate: moderate by hiding (is_published), never erase a
 * review outright. No delete action exists here on purpose.
 */
export async function setReviewPublished(reviewId: string, isPublished: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").update({ is_published: isPublished }).eq("id", reviewId);
  if (error) {
    logger.error("review publish toggle failed", error, { reviewId });
    return { error: "Could not update this review. Please try again." };
  }

  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function setReviewFeatured(reviewId: string, isFeatured: boolean): Promise<ActionResult> {
  const supabase = await createClient();

  if (isFeatured) {
    const { data: review } = await supabase.from("reviews").select("is_published").eq("id", reviewId).single();
    if (!review?.is_published) return { error: "Publish this review before featuring it." };
  }

  const { error } = await supabase.from("reviews").update({ is_featured: isFeatured }).eq("id", reviewId);
  if (error) {
    logger.error("review feature toggle failed", error, { reviewId });
    return { error: "Could not update this review. Please try again." };
  }

  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function respondToReview(reviewId: string, formData: FormData): Promise<ActionResult> {
  const response = formData.get("adminResponse");
  if (typeof response !== "string" || !response.trim()) return { error: "Enter a response." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("reviews")
    .update({ admin_response: response.trim() })
    .eq("id", reviewId);
  if (error) {
    logger.error("review response failed", error, { reviewId });
    return { error: "Could not save this response. Please try again." };
  }

  revalidatePath("/admin/reviews");
  return { success: true };
}
