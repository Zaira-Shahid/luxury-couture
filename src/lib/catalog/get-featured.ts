import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Collection, Product, Review } from "@/types/database";

export type FeaturedProduct = Product & { image_url: string | null };

export const getFeaturedCollections = cache(async (): Promise<Collection[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(6);

  if (error) {
    logger.warn("failed to load featured collections", { message: error.message });
    return [];
  }
  return (data ?? []) as Collection[];
});

export const getFeaturedProducts = cache(async (): Promise<FeaturedProduct[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(url, is_primary)")
    .eq("status", "published")
    .eq("is_featured", true)
    .order("published_at", { ascending: false })
    .limit(8);

  if (error) {
    logger.warn("failed to load featured products", { message: error.message });
    return [];
  }

  type Row = Product & { product_images: { url: string; is_primary: boolean }[] };
  return ((data ?? []) as Row[]).map((row) => {
    const { product_images, ...product } = row;
    const primary = product_images.find((img) => img.is_primary) ?? product_images[0];
    return { ...product, image_url: primary?.url ?? null };
  });
});

/**
 * reviews.customer_id -> profiles is owner/admin-only RLS, so a joined
 * customer name would come back null for anonymous visitors — showing
 * testimonials with a generic "Verified Customer" attribution rather than
 * opening a new public-read carve-out on profiles just for display names.
 */
export const getFeaturedTestimonials = cache(async (): Promise<Review[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("is_published", true)
    .eq("is_featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    logger.warn("failed to load featured testimonials", { message: error.message });
    return [];
  }
  return (data ?? []) as Review[];
});
