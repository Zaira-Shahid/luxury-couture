import { cache } from "react";

import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import type { BuilderOptionTable, Occasion, UUID } from "@/types/database";

/**
 * Occasions taxonomy reads (Module 23). Active-only for the storefront;
 * RLS enforces the same rule underneath, so the filter here is for
 * correct behaviour rather than for security.
 */

export const getActiveOccasions = cache(async (): Promise<Occasion[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    logger.warn("failed to load occasions", { message: error.message });
    return [];
  }
  return (data ?? []) as Occasion[];
});

export const getOccasionBySlug = cache(async (slug: string): Promise<Occasion | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("occasions")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    logger.warn("failed to load occasion", { message: error.message, slug });
    return null;
  }
  return (data ?? null) as Occasion | null;
});

/**
 * Which builder options suit a given occasion, as a map of option table →
 * option ids. Used for builder guidance ("popular for mehndi") — real
 * curated data rather than generated prose.
 */
export const getOccasionOptionIds = cache(
  async (occasionSlug: string): Promise<Partial<Record<BuilderOptionTable, UUID[]>>> => {
    const supabase = await createClient();
    const occasion = await getOccasionBySlug(occasionSlug);
    if (!occasion) return {};

    const { data, error } = await supabase
      .from("builder_option_occasions")
      .select("option_table, option_id")
      .eq("occasion_id", occasion.id);

    if (error) {
      logger.warn("failed to load occasion options", { message: error.message, occasionSlug });
      return {};
    }

    const grouped: Partial<Record<BuilderOptionTable, UUID[]>> = {};
    for (const row of data ?? []) {
      const table = row.option_table as BuilderOptionTable;
      (grouped[table] ??= []).push(row.option_id as UUID);
    }
    return grouped;
  }
);

/**
 * Reverse lookup for the builder UI: option id → the occasion names it
 * suits, so a fabric or colour tile can show "Popular for Bridal, Walima"
 * without the step needing to know about occasions at all.
 */
export const getOptionOccasionLabels = cache(
  async (optionTable: BuilderOptionTable): Promise<Record<UUID, string[]>> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("builder_option_occasions")
      .select("option_id, occasions!inner(name, is_active, sort_order)")
      .eq("option_table", optionTable)
      .eq("occasions.is_active", true);

    if (error) {
      logger.warn("failed to load option occasion labels", {
        message: error.message,
        optionTable,
      });
      return {};
    }

    const labels: Record<UUID, string[]> = {};
    const rows = (data ?? []) as unknown as {
      option_id: UUID;
      occasions: { name: string; sort_order: number };
    }[];

    for (const row of rows) {
      (labels[row.option_id] ??= []).push(row.occasions.name);
    }
    for (const id of Object.keys(labels)) labels[id].sort();
    return labels;
  }
);
