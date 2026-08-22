import { cache } from "react";

import { recommendProductIds } from "@/lib/ai/recommendations";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Product, ProductImage } from "@/types/database";

export type ProductWithImages = Product & { product_images: ProductImage[] };

/**
 * Storefront product search and filtering (Module 23).
 *
 * `q` is what makes the `SearchAction` declared in the WebSite JSON-LD
 * (lib/seo/structured-data.ts, Module 20) actually true — that schema
 * advertised `/products?q=` to Google before any such search existed.
 *
 * The same filters back the chatbot's discovery: the assistant parses a
 * message into an intent and calls this, so customers see real rows from
 * one code path rather than a separately-invented product list.
 */
export type ProductFilters = {
  categorySlug?: string;
  /** Free-text against name and description. */
  q?: string;
  occasionSlug?: string;
  /** Exact colour/fabric names — matched against product text, since
   *  products aren't linked to builder options in the schema. */
  colourNames?: string[];
  fabricNames?: string[];
  limit?: number;
};

/** Escapes PostgREST `or()` metacharacters so a stray comma can't rewrite the filter. */
function escapeForOr(value: string): string {
  return value.replace(/[,()]/g, " ").trim();
}

export const getPublishedProducts = cache(
  async (filtersOrCategory?: string | ProductFilters): Promise<ProductWithImages[]> => {
    // Backwards-compatible: existing callers pass a bare category slug.
    const filters: ProductFilters =
      typeof filtersOrCategory === "string"
        ? { categorySlug: filtersOrCategory }
        : (filtersOrCategory ?? {});

    const supabase = await createClient();
    let query = supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    if (filters.categorySlug) {
      const { data: category } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", filters.categorySlug)
        .single();
      if (!category) return [];
      query = query.eq("category_id", category.id);
    }

    if (filters.occasionSlug) {
      const { data: occasion } = await supabase
        .from("occasions")
        .select("id")
        .eq("slug", filters.occasionSlug)
        .eq("is_active", true)
        .maybeSingle();
      if (!occasion) return [];

      const { data: links } = await supabase
        .from("product_occasions")
        .select("product_id")
        .eq("occasion_id", occasion.id);

      const ids = (links ?? []).map((row) => row.product_id as string);
      // An occasion nobody has tagged yet must return nothing, not
      // everything — an unfiltered fallback would silently show bridal
      // pieces to someone asking for party wear.
      if (ids.length === 0) return [];
      query = query.in("id", ids);
    }

    // Colour and fabric are matched against product text: products carry
    // no FK to builder options in this schema, so this is the honest
    // best available signal rather than a join that doesn't exist.
    const textTerms = [filters.q, ...(filters.colourNames ?? []), ...(filters.fabricNames ?? [])]
      .map((term) => (term ? escapeForOr(term) : ""))
      .filter(Boolean);

    if (textTerms.length > 0) {
      const clauses = textTerms.flatMap((term) => [
        `name.ilike.%${term}%`,
        `description.ilike.%${term}%`,
      ]);
      query = query.or(clauses.join(","));
    }

    if (filters.limit) query = query.limit(filters.limit);

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
