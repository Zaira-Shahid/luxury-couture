"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import { logger } from "@/lib/logger";
import { getOrderDetail } from "@/lib/orders/get-orders";
import { deleteFromStorage, randomStoragePath, uploadToStorage } from "@/lib/storage/upload-to-storage";
import { MAX_IMAGE_BYTES, validateImageFile } from "@/lib/storage/validate-file";
import { createClient } from "@/lib/supabase/server";
import { addReviewVideoLinkSchema, submitReviewSchema } from "@/lib/validations/reviews";

export type ActionResult<T = undefined> = { error: string } | { success: true; data: T };

/**
 * Gated on the order's shipment having actually reached 'delivered' — the
 * same signal that already fires Module 15's review_request notification,
 * so the CTA and the notification stay consistent. Enforced here, not
 * just hidden in the UI: a tampered orderId/productId is checked against
 * what the order actually contains before anything is written.
 */
export async function submitReview(formData: FormData): Promise<ActionResult<{ reviewId: string }>> {
  const parsed = submitReviewSchema.safeParse({
    orderId: formData.get("orderId"),
    productId: formData.get("productId") ?? "",
    rating: formData.get("rating"),
    title: formData.get("title") ?? "",
    body: formData.get("body") ?? "",
    reviewerName: formData.get("reviewerName") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const detail = await getOrderDetail(parsed.data.orderId);
  if (!detail || detail.order.customer_id !== user.id) return { error: "Order not found." };
  if (detail.shipping?.status !== "delivered") {
    return { error: "You can leave a review once this order has been delivered." };
  }

  let productId: string | null = null;
  if (parsed.data.productId) {
    const matchesOrder = detail.items.some((item) => item.product_id === parsed.data.productId);
    if (!matchesOrder) return { error: "Choose a product from this order." };
    productId = parsed.data.productId;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      customer_id: user.id,
      order_id: detail.order.id,
      product_id: productId,
      rating: parsed.data.rating,
      title: parsed.data.title || null,
      body: parsed.data.body || null,
      reviewer_name: parsed.data.reviewerName || null,
      is_published: false,
    })
    .select("id")
    .single();

  if (error || !data) {
    logger.error("review submission failed", error, { orderId: parsed.data.orderId });
    return { error: "Could not submit your review. Please try again." };
  }

  revalidatePath(`/account/orders/${parsed.data.orderId}`);
  return { success: true, data: { reviewId: data.id } };
}

async function assertOwnsReview(supabase: Awaited<ReturnType<typeof createClient>>, reviewId: string, userId: string) {
  const { data } = await supabase.from("reviews").select("id").eq("id", reviewId).eq("customer_id", userId).maybeSingle();
  return !!data;
}

export async function uploadReviewPhoto(reviewId: string, formData: FormData): Promise<ActionResult<{ url: string }>> {
  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const supabase = await createClient();
  if (!(await assertOwnsReview(supabase, reviewId, user.id))) return { error: "Review not found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };

  const validationError = validateImageFile(file, MAX_IMAGE_BYTES);
  if (validationError) return { error: validationError };

  const path = randomStoragePath("review-media", file);
  const uploaded = await uploadToStorage("review-media", path, file);
  if ("error" in uploaded) {
    logger.error("review photo upload failed", new Error(uploaded.error));
    return { error: "Could not upload that photo. Please try again." };
  }

  const { error } = await supabase.from("review_media").insert({ review_id: reviewId, url: uploaded.url, type: "image" });
  if (error) {
    await deleteFromStorage("review-media", uploaded.path);
    logger.error("review media insert failed", error, { reviewId });
    return { error: "Could not attach that photo. Please try again." };
  }

  return { success: true, data: { url: uploaded.url } };
}

export async function addReviewVideoLink(reviewId: string, formData: FormData): Promise<ActionResult> {
  const parsed = addReviewVideoLinkSchema.safeParse({ url: formData.get("url") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const user = await getAuthUser();
  if (!user) return { error: "You must be signed in." };

  const supabase = await createClient();
  if (!(await assertOwnsReview(supabase, reviewId, user.id))) return { error: "Review not found." };

  const { error } = await supabase
    .from("review_media")
    .insert({ review_id: reviewId, url: parsed.data.url, type: "video" });
  if (error) {
    logger.error("review video link failed", error, { reviewId });
    return { error: "Could not add that link. Please try again." };
  }

  return { success: true, data: undefined };
}
