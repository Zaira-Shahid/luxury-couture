import { cache } from "react";

import { recommendProductIds } from "@/lib/ai/recommendations";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Product, ProductImage } from "@/types/database";

export type ProductWithImages = Product & { product_images: ProductImage[] };

export const getPublishedProducts = cache(
  async (categorySlug?: string): Promise<ProductWithImages[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (categorySlug) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", categorySlug)
        .single();
      if (!category) return [];
      query = query.eq("category_id", category.id);
    }

    const { data, error } = await query;
    if (error) {
      logger.warn("failed to load products", { message: error.message });
      return [];
    }
    return (data ?? []) as ProductWithImages[];
  }
);

export const getProductBySlug = cache(async (slug: string): Promise<ProductWithImages | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(*)")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    logger.warn("failed to load product", { message: error.message, slug });
    return null;
  }
  return data as ProductWithImages | null;
});

/**
 * Related products for the PDP.
 *
 * Module 22 moved the ranking into the recommendation engine
 * (lib/ai/recommendations.ts), which layers co-view and co-purchase
 * affinity on top of the category match this used to do alone, then falls
 * back through collection, featured and newest. Two consequences worth
 * knowing: a product with no category still gets recommendations now
 * (previously it got none), and the returned order is meaningful — the
 * engine ranks, so callers must preserve it rather than re-sorting.
 */
export const getRelatedProducts = cache(
  async (product: Product, limit = 4): Promise<ProductWithImages[]> => {
    const recommendations = await recommendProductIds(product, limit);
    if (recommendations.length === 0) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("status", "published")
      .in(
        "id",
        recommendations.map((r) => r.productId)
      );

    if (error) {
      logger.warn("failed to load related products", { message: error.message });
      return [];
    }

    // `.in()` returns rows in arbitrary order — restore the engine's
    // ranking, which is the whole point of asking it.
    const byId = new Map((data ?? []).map((row) => [row.id, row as ProductWithImages]));
    return recommendations
      .map((r) => byId.get(r.productId))
      .filter((row): row is ProductWithImages => Boolean(row));
  }
);
