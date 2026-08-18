import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Collection } from "@/types/database";
import type { ProductWithImages } from "./get-products";

export const getActiveCollections = cache(async (): Promise<Collection[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("is_active", true)
    .order("published_at", { ascending: false });

  if (error) {
    logger.warn("failed to load collections", { message: error.message });
    return [];
  }
  return (data ?? []) as Collection[];
});

export const getCollectionBySlug = cache(async (slug: string): Promise<Collection | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logger.warn("failed to load collection", { message: error.message, slug });
    return null;
  }
  return data as Collection | null;
});

export const getCollectionProducts = cache(
  async (collectionId: string): Promise<ProductWithImages[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("product_collections")
      .select("products(*, product_images(*))")
      .eq("collection_id", collectionId);

    if (error) {
      logger.warn("failed to load collection products", { message: error.message, collectionId });
      return [];
    }

    type Row = { products: ProductWithImages | null };
    return ((data ?? []) as unknown as Row[])
      .map((row) => row.products)
      .filter((p): p is ProductWithImages => p !== null && p.status === "published");
  }
);
