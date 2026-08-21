"use server";

import { revalidatePath } from "next/cache";

import { trackServer } from "@/lib/analytics/track-server";
import { logger } from "@/lib/logger";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { error: string } | { success: true };

export async function toggleWishlist(productId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save items to your wishlist." };

  const { data: existing } = await supabase
    .from("wishlist_items")
    .select("id")
    .eq("customer_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from("wishlist_items").delete().eq("id", existing.id);
    if (error) {
      logger.error("wishlist remove failed", error, { userId: user.id, productId });
      return { error: "Could not update your wishlist. Please try again." };
    }
  } else {
    const { error } = await supabase
      .from("wishlist_items")
      .insert({ customer_id: user.id, product_id: productId });
    if (error) {
      logger.error("wishlist add failed", error, { userId: user.id, productId });
      return { error: "Could not update your wishlist. Please try again." };
    }
  }

  await trackServer(
    "wishlist_action",
    { productId, action: existing ? "removed" : "added" },
    { profileId: user.id }
  );

  revalidatePath("/account/wishlist");
  return { success: true };
}

export async function removeFromWishlist(itemId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const { error } = await supabase
    .from("wishlist_items")
    .delete()
    .eq("id", itemId)
    .eq("customer_id", user.id);

  if (error) {
    logger.error("wishlist remove failed", error, { userId: user.id, itemId });
    return { error: "Could not remove the item. Please try again." };
  }

  revalidatePath("/account/wishlist");
  return { success: true };
}
