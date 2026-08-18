import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { Colour, EmbroideryType, Fabric } from "@/types/database";

/**
 * Global, unfiltered builder lookup options (Module 1 seed data) — there's
 * no per-product variant-restriction table, so the product page shows
 * these as a "what's possible" teaser linking to the Custom Builder
 * (Module 6), not per-product-scoped choices.
 */
export const getCustomizeTeaserOptions = cache(async () => {
  const supabase = await createClient();
  const [fabrics, embroidery, colours] = await Promise.all([
    supabase.from("fabrics").select("*").eq("is_active", true).order("sort_order").limit(6),
    supabase.from("embroidery_types").select("*").eq("is_active", true).order("sort_order").limit(6),
    supabase.from("colours").select("*").eq("is_active", true).order("sort_order").limit(8),
  ]);

  if (fabrics.error) logger.warn("failed to load fabrics", { message: fabrics.error.message });
  if (embroidery.error)
    logger.warn("failed to load embroidery types", { message: embroidery.error.message });
  if (colours.error) logger.warn("failed to load colours", { message: colours.error.message });

  return {
    fabrics: (fabrics.data ?? []) as Fabric[],
    embroidery: (embroidery.data ?? []) as EmbroideryType[],
    colours: (colours.data ?? []) as Colour[],
  };
});
