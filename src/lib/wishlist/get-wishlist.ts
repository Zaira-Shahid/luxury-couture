import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { ProductWithImages } from "@/lib/catalog/get-products";

/** Product IDs the signed-in customer has wishlisted; empty when signed out. */
export const getWishlistedProductIds = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("product_id")
    .eq("customer_id", user.id);

  if (error) {
    logger.warn("failed to load wishlist ids", { message: error.message });
    return new Set();
  }
  return new Set((data ?? []).map((row) => row.product_id as string));
});

export type WishlistItem = { id: string; product: ProductWithImages };

/** Full wishlist items with product data, for the account/wishlist page. */
export const getWishlistItems = cache(async (): Promise<WishlistItem[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("wishlist_items")
    .select("id, products(*, product_images(*))")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    logger.warn("failed to load wishlist items", { message: error.message });
    return [];
  }

  type Row = { id: string; products: ProductWithImages | null };
  return ((data ?? []) as unknown as Row[])
    .filter((row): row is { id: string; products: ProductWithImages } => row.products !== null)
    .map((row) => ({ id: row.id, product: row.products }));
});
