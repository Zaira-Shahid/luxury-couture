import { cache } from "react";

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

export const getRelatedProducts = cache(
  async (product: Product, limit = 4): Promise<ProductWithImages[]> => {
    if (!product.category_id) return [];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("status", "published")
      .eq("category_id", product.category_id)
      .neq("id", product.id)
      .limit(limit);

    if (error) {
      logger.warn("failed to load related products", { message: error.message });
      return [];
    }
    return (data ?? []) as ProductWithImages[];
  }
);
